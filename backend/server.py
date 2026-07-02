from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import io
import csv
import logging
import asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta
from collections import Counter

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

YT_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', os.environ.get('EMERGENT_LLM_KEY', ''))

app = FastAPI(title="Creator Intelligence API")
api_router = APIRouter(prefix="/api")

YT_BASE = "https://www.googleapis.com/youtube/v3"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class ChannelSummary(BaseModel):
    channel_id: str
    name: str
    handle: Optional[str] = None
    custom_url: Optional[str] = None
    thumbnail: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    subscribers: int = 0
    total_views: int = 0
    video_count: int = 0
    avg_views_per_video: float = 0
    engagement_rate: float = 0
    last_upload: Optional[str] = None
    uploads_per_month: float = 0
    niche: Optional[str] = None
    subniches: List[str] = Field(default_factory=list)
    prospect_score: int = 0
    has_email: bool = False
    has_instagram: bool = False
    has_linkedin: bool = False
    has_website: bool = False


class ChannelDetail(ChannelSummary):
    description: str = ""
    created_at: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    avg_views_last10: float = 0
    avg_views_last30: float = 0
    avg_likes: float = 0
    avg_comments: float = 0
    uploads_per_week: float = 0
    social_links: List[Dict[str, Any]] = Field(default_factory=list)
    contacts: List[Dict[str, Any]] = Field(default_factory=list)
    prospect_reasons: List[str] = Field(default_factory=list)
    content_mix: Dict[str, int] = Field(default_factory=dict)
    top_topics: List[Dict[str, Any]] = Field(default_factory=list)
    top_brands: List[str] = Field(default_factory=list)
    top_products: List[str] = Field(default_factory=list)
    top_software: List[str] = Field(default_factory=list)
    recent_videos: List[Dict[str, Any]] = Field(default_factory=list)
    monthly_views_trend: List[Dict[str, Any]] = Field(default_factory=list)


# ---------- Helpers ----------
async def yt_get(client_http: httpx.AsyncClient, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    params = {**params, "key": YT_API_KEY}
    r = await client_http.get(f"{YT_BASE}{path}", params=params, timeout=30.0)
    if r.status_code != 200:
        logger.error(f"YT API error {r.status_code}: {r.text[:400]}")
        raise HTTPException(status_code=502, detail=f"YouTube API error: {r.status_code}")
    return r.json()


URL_RE = re.compile(r"https?://[^\s\)\]\<\>\"']+", re.IGNORECASE)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

SOCIAL_PATTERNS = [
    ("instagram", re.compile(r"(?:instagram\.com|instagr\.am)/([A-Za-z0-9_.\-]+)", re.I)),
    ("tiktok", re.compile(r"tiktok\.com/@?([A-Za-z0-9_.\-]+)", re.I)),
    ("twitter", re.compile(r"(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)", re.I)),
    ("linkedin", re.compile(r"linkedin\.com/(?:in|company)/([A-Za-z0-9_\-]+)", re.I)),
    ("facebook", re.compile(r"facebook\.com/([A-Za-z0-9_.\-]+)", re.I)),
    ("discord", re.compile(r"(?:discord\.gg|discord\.com/invite)/([A-Za-z0-9_\-]+)", re.I)),
    ("telegram", re.compile(r"(?:t\.me|telegram\.me)/([A-Za-z0-9_]+)", re.I)),
    ("twitch", re.compile(r"twitch\.tv/([A-Za-z0-9_]+)", re.I)),
    ("kick", re.compile(r"kick\.com/([A-Za-z0-9_]+)", re.I)),
]

KNOWN_SOCIAL_HOSTS = {"instagram.com", "instagr.am", "tiktok.com", "twitter.com", "x.com",
                       "linkedin.com", "facebook.com", "fb.com", "discord.gg", "discord.com",
                       "t.me", "telegram.me", "twitch.tv", "kick.com", "youtube.com", "youtu.be"}


def extract_socials_and_website(text: str, extra_links: List[str] = None) -> (List[Dict[str, Any]], List[str]):
    text = text or ""
    urls = set(URL_RE.findall(text))
    if extra_links:
        for u in extra_links:
            if u:
                urls.add(u)
    socials = []
    websites = []
    seen_platforms = set()
    for u in urls:
        matched = False
        for platform, pat in SOCIAL_PATTERNS:
            m = pat.search(u)
            if m:
                key = (platform, m.group(1).lower())
                if key in seen_platforms:
                    matched = True
                    break
                seen_platforms.add(key)
                socials.append({
                    "platform": platform,
                    "url": u,
                    "username": m.group(1)
                })
                matched = True
                break
        if not matched:
            # website candidate
            host = re.sub(r"^https?://(www\.)?", "", u).split("/")[0].lower()
            if host and not any(h in host for h in KNOWN_SOCIAL_HOSTS):
                websites.append(u)
    return socials, list(dict.fromkeys(websites))


def extract_emails(text: str) -> List[str]:
    text = text or ""
    emails = list(dict.fromkeys(EMAIL_RE.findall(text)))
    # Filter obvious noise
    return [e for e in emails if not e.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]


def iso_to_dt(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def compute_prospect_score(metrics: Dict[str, Any]) -> (int, List[str]):
    reasons = []
    score = 0
    subs = metrics.get("subscribers", 0)
    if subs >= 1_000_000:
        score += 20; reasons.append("High authority (1M+ subs)")
    elif subs >= 100_000:
        score += 16; reasons.append("Strong authority (100k+ subs)")
    elif subs >= 10_000:
        score += 10; reasons.append("Established audience (10k+ subs)")
    elif subs >= 1000:
        score += 5

    er = metrics.get("engagement_rate", 0)
    if er >= 5: score += 18; reasons.append("Exceptional engagement rate")
    elif er >= 2: score += 12; reasons.append("Healthy engagement rate")
    elif er >= 0.5: score += 6

    upm = metrics.get("uploads_per_month", 0)
    if upm >= 8: score += 12; reasons.append("Highly consistent publisher")
    elif upm >= 3: score += 8; reasons.append("Consistent publishing cadence")
    elif upm >= 1: score += 4

    last = metrics.get("last_upload")
    if last:
        dt = iso_to_dt(last)
        if dt:
            days = (datetime.now(timezone.utc) - dt).days
            if days <= 7: score += 10; reasons.append("Active in last 7 days")
            elif days <= 30: score += 6; reasons.append("Active in last 30 days")

    # growth proxy: avg views vs subs
    avg_v = metrics.get("avg_views_last10", 0)
    if subs and avg_v:
        ratio = avg_v / max(subs, 1)
        if ratio >= 0.3: score += 12; reasons.append("Accelerated view velocity vs. subs")
        elif ratio >= 0.1: score += 7

    if metrics.get("has_email"): score += 12; reasons.append("Public commercial email found")
    if metrics.get("social_count", 0) >= 3: score += 8; reasons.append("Multi-channel presence")
    elif metrics.get("social_count", 0) >= 1: score += 4

    if metrics.get("has_website"): score += 5; reasons.append("Owned website / brand asset")

    return min(score, 100), reasons


async def batch_classify(channels: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Classify multiple channels in a single LLM call. Returns {channel_id: {niche, subniches}}."""
    if not GOOGLE_API_KEY or not channels:
        return {}
    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        sys_msg = (
            "You classify YouTube channels for B2B prospecting. "
            "Return ONLY valid JSON: an object with key 'channels' -> array of objects, one per input, "
            "each having: id (echo input id), main_niche (short string), subniches (array of up to 3 short strings). "
            "No prose, no markdown."
        )
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=sys_msg
        )
        payload = {"channels": [{
            "id": c["id"],
            "name": c["name"],
            "description": (c.get("description") or "")[:500],
            "keywords": (c.get("keywords") or [])[:10],
            "sample_titles": (c.get("titles") or [])[:8],
        } for c in channels]}
        async with AI_SEM:
            for attempt in range(3):
                try:
                    response = await model.generate_content_async(
                        contents=json.dumps(payload, ensure_ascii=False),
                        generation_config={"response_mime_type": "application/json"}
                    )
                    text = response.text
                    break
                except Exception as e:
                    if "429" in str(e) or "rate" in str(e).lower() or "quota" in str(e).lower():
                        await asyncio.sleep(1.5 * (attempt + 1)); continue
                    raise
            else:
                return {}
        m = re.search(r"\{[\s\S]*\}", text)
        if not m: return {}
        data = json.loads(m.group(0))
        out = {}
        for item in data.get("channels", []):
            out[item.get("id")] = {
                "main_niche": item.get("main_niche"),
                "subniches": item.get("subniches", [])[:5],
            }
        return out
    except Exception as e:
        logger.warning(f"batch classify failed: {e}")
        return {}


AI_SEM = asyncio.Semaphore(1)

async def classify_with_ai(name: str, description: str, keywords: List[str], video_titles: List[str]) -> Dict[str, Any]:
    """Use Gemini to classify niche, extract topics/brands/products/software and content mix."""
    if not GOOGLE_API_KEY:
        return {}
    async with AI_SEM:
        return await _classify_with_ai_inner(name, description, keywords, video_titles)


async def _classify_with_ai_inner(name: str, description: str, keywords: List[str], video_titles: List[str]) -> Dict[str, Any]:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        sys_msg = (
            "You are an expert YouTube creator analyst. Classify channels for B2B prospecting. "
            "Return ONLY valid JSON with keys: main_niche (string), subniches (array of up to 5 strings), "
            "top_topics (array of {topic, weight 0-100} up to 6), brands (array of strings, max 8), "
            "products (array of strings, max 8), software (array of strings, max 8), "
            "content_mix (object with numeric percentages 0-100 for keys: educational, entertainment, technical, commercial, institutional; must sum ~100), "
            "keywords (array of up to 10 strings). No markdown, no prose."
        )
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=sys_msg
        )
        prompt = {
            "channel_name": name,
            "description": (description or "")[:2000],
            "keywords": keywords[:20],
            "recent_video_titles": video_titles[:20],
        }
        text = ""
        for attempt in range(3):
            try:
                response = await model.generate_content_async(
                    contents=json.dumps(prompt, ensure_ascii=False),
                    generation_config={"response_mime_type": "application/json"}
                )
                text = response.text
                break
            except Exception as e:
                if "429" in str(e) or "rate" in str(e).lower() or "quota" in str(e).lower():
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                raise
        if not text:
            return {}
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return {}
        data = json.loads(m.group(0))
        return data
    except Exception as e:
        logger.warning(f"AI classify failed: {e}")
        return {}


def parse_iso_duration(dur: str) -> int:
    if not dur: return 0
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", dur)
    if not m: return 0
    h = int(m.group(1) or 0); mi = int(m.group(2) or 0); s = int(m.group(3) or 0)
    return h*3600 + mi*60 + s


async def enrich_channel(channel_id: str, use_ai: bool = True) -> ChannelDetail:
    async with httpx.AsyncClient() as http:
        # Get channel details
        ch = await yt_get(http, "/channels", {
            "part": "snippet,statistics,brandingSettings,contentDetails,topicDetails",
            "id": channel_id
        })
        items = ch.get("items", [])
        if not items:
            raise HTTPException(404, "Channel not found")
        c = items[0]
        sn = c.get("snippet", {})
        st = c.get("statistics", {})
        br = c.get("brandingSettings", {}).get("channel", {})
        cd = c.get("contentDetails", {})

        uploads_pid = cd.get("relatedPlaylists", {}).get("uploads")
        recent_vids = []
        video_ids = []
        if uploads_pid:
            pl = await yt_get(http, "/playlistItems", {
                "part": "snippet,contentDetails",
                "playlistId": uploads_pid,
                "maxResults": 30
            })
            for it in pl.get("items", []):
                vid = it.get("contentDetails", {}).get("videoId")
                if vid:
                    video_ids.append(vid)

        videos = []
        if video_ids:
            v = await yt_get(http, "/videos", {
                "part": "snippet,statistics,contentDetails",
                "id": ",".join(video_ids[:50])
            })
            videos = v.get("items", [])

        subs = int(st.get("subscriberCount", 0)) if not st.get("hiddenSubscriberCount") else 0
        total_views = int(st.get("viewCount", 0))
        video_count = int(st.get("videoCount", 0))

        # Metrics
        view_counts = [int(x.get("statistics", {}).get("viewCount", 0)) for x in videos]
        like_counts = [int(x.get("statistics", {}).get("likeCount", 0)) for x in videos if x.get("statistics", {}).get("likeCount")]
        comment_counts = [int(x.get("statistics", {}).get("commentCount", 0)) for x in videos if x.get("statistics", {}).get("commentCount")]

        avg_views_last10 = sum(view_counts[:10]) / max(len(view_counts[:10]), 1)
        avg_views_last30 = sum(view_counts[:30]) / max(len(view_counts[:30]), 1)
        avg_views_per_video = total_views / max(video_count, 1)
        avg_likes = sum(like_counts) / max(len(like_counts), 1) if like_counts else 0
        avg_comments = sum(comment_counts) / max(len(comment_counts), 1) if comment_counts else 0

        engagement = 0.0
        if avg_views_last30 > 0:
            engagement = ((avg_likes + avg_comments) / avg_views_last30) * 100

        # Upload cadence
        pub_dates = []
        for x in videos:
            d = iso_to_dt(x.get("snippet", {}).get("publishedAt", ""))
            if d: pub_dates.append(d)
        pub_dates.sort(reverse=True)
        last_upload = pub_dates[0].isoformat() if pub_dates else None

        uploads_per_month = 0.0
        uploads_per_week = 0.0
        if len(pub_dates) >= 2:
            span_days = max((pub_dates[0] - pub_dates[-1]).days, 1)
            uploads_per_month = len(pub_dates) / (span_days / 30.0)
            uploads_per_week = len(pub_dates) / (span_days / 7.0)

        # Monthly views trend
        month_bucket = Counter()
        for x in videos:
            d = iso_to_dt(x.get("snippet", {}).get("publishedAt", ""))
            if d:
                key = d.strftime("%Y-%m")
                month_bucket[key] += int(x.get("statistics", {}).get("viewCount", 0))
        trend = sorted([{"month": k, "views": v} for k, v in month_bucket.items()], key=lambda z: z["month"])

        # Description & links
        description = sn.get("description", "") or ""
        keywords_raw = br.get("keywords", "") or ""
        # Keywords come space-separated with quoted phrases
        keywords = re.findall(r'"([^"]+)"|(\S+)', keywords_raw)
        keywords = [a or b for a, b in keywords]

        video_titles = [x.get("snippet", {}).get("title", "") for x in videos]
        video_desc_concat = " ".join(x.get("snippet", {}).get("description", "") or "" for x in videos[:10])
        video_tags = []
        for x in videos:
            video_tags.extend(x.get("snippet", {}).get("tags", []) or [])

        socials, websites = extract_socials_and_website(description + " " + video_desc_concat)
        emails = extract_emails(description + " " + video_desc_concat)

        contacts = []
        for e in emails:
            contacts.append({
                "type": "email",
                "value": e,
                "source": "channel_description",
                "confidence": "high",
                "collected_at": datetime.now(timezone.utc).isoformat()
            })
        for s in socials:
            if s["platform"] == "instagram":
                contacts.append({"type": "instagram_dm", "value": s["url"], "source": "channel_description",
                                 "confidence": "medium", "collected_at": datetime.now(timezone.utc).isoformat()})
            if s["platform"] == "linkedin":
                contacts.append({"type": "linkedin", "value": s["url"], "source": "channel_description",
                                 "confidence": "medium", "collected_at": datetime.now(timezone.utc).isoformat()})
        for w in websites:
            contacts.append({"type": "website", "value": w, "source": "channel_description",
                             "confidence": "medium", "collected_at": datetime.now(timezone.utc).isoformat()})

        has_email = len(emails) > 0
        has_instagram = any(s["platform"] == "instagram" for s in socials)
        has_linkedin = any(s["platform"] == "linkedin" for s in socials)
        has_website = len(websites) > 0

        # AI classification
        ai = {}
        if use_ai:
            ai = await classify_with_ai(sn.get("title", ""), description, keywords + video_tags[:15], video_titles)

        niche = ai.get("main_niche") or "Uncategorized"
        subniches = ai.get("subniches", [])[:5]
        top_topics = ai.get("top_topics", [])[:6]
        content_mix = ai.get("content_mix", {}) or {}
        top_brands = ai.get("brands", [])[:8]
        top_products = ai.get("products", [])[:8]
        top_software = ai.get("software", [])[:8]
        ai_keywords = ai.get("keywords", [])[:10]

        score_input = {
            "subscribers": subs,
            "engagement_rate": engagement,
            "uploads_per_month": uploads_per_month,
            "last_upload": last_upload,
            "avg_views_last10": avg_views_last10,
            "has_email": has_email,
            "has_website": has_website,
            "social_count": len(socials),
        }
        score, reasons = compute_prospect_score(score_input)

        thumbnail = (sn.get("thumbnails", {}) or {}).get("high", {}).get("url") or \
                    (sn.get("thumbnails", {}) or {}).get("default", {}).get("url")

        recent = []
        for x in videos[:12]:
            recent.append({
                "video_id": x.get("id"),
                "title": x.get("snippet", {}).get("title"),
                "published_at": x.get("snippet", {}).get("publishedAt"),
                "views": int(x.get("statistics", {}).get("viewCount", 0)),
                "likes": int(x.get("statistics", {}).get("likeCount", 0) or 0),
                "comments": int(x.get("statistics", {}).get("commentCount", 0) or 0),
                "thumbnail": (x.get("snippet", {}).get("thumbnails", {}) or {}).get("medium", {}).get("url"),
            })

        detail = ChannelDetail(
            channel_id=channel_id,
            name=sn.get("title", ""),
            handle=sn.get("customUrl"),
            custom_url=sn.get("customUrl"),
            thumbnail=thumbnail,
            country=sn.get("country") or br.get("country"),
            language=sn.get("defaultLanguage"),
            description=description,
            created_at=sn.get("publishedAt"),
            keywords=list(dict.fromkeys((keywords or []) + ai_keywords))[:20],
            subscribers=subs,
            total_views=total_views,
            video_count=video_count,
            avg_views_per_video=round(avg_views_per_video, 1),
            avg_views_last10=round(avg_views_last10, 1),
            avg_views_last30=round(avg_views_last30, 1),
            avg_likes=round(avg_likes, 1),
            avg_comments=round(avg_comments, 1),
            engagement_rate=round(engagement, 2),
            uploads_per_month=round(uploads_per_month, 2),
            uploads_per_week=round(uploads_per_week, 2),
            last_upload=last_upload,
            niche=niche,
            subniches=subniches,
            social_links=socials,
            contacts=contacts,
            prospect_score=score,
            prospect_reasons=reasons,
            content_mix={k: int(v) for k, v in content_mix.items() if isinstance(v, (int, float))},
            top_topics=top_topics,
            top_brands=top_brands,
            top_products=top_products,
            top_software=top_software,
            has_email=has_email,
            has_instagram=has_instagram,
            has_linkedin=has_linkedin,
            has_website=has_website,
            recent_videos=recent,
            monthly_views_trend=trend,
        )
        # cache
        doc = detail.model_dump()
        doc["_cached_at"] = datetime.now(timezone.utc).isoformat()
        await db.channels.update_one({"channel_id": channel_id}, {"$set": doc}, upsert=True)
        return detail


async def get_channel_cached(channel_id: str, use_ai: bool = True, max_age_hours: int = 24) -> ChannelDetail:
    doc = await db.channels.find_one({"channel_id": channel_id}, {"_id": 0})
    if doc and doc.get("_cached_at"):
        cached_at = iso_to_dt(doc["_cached_at"])
        if cached_at and (datetime.now(timezone.utc) - cached_at) < timedelta(hours=max_age_hours):
            doc.pop("_cached_at", None)
            try:
                return ChannelDetail(**doc)
            except Exception as e:
                logger.warning(f"cache parse failed, refetching: {e}")
    return await enrich_channel(channel_id, use_ai=use_ai)


# ---------- Endpoints ----------
@api_router.get("/")
async def root():
    return {"service": "Creator Intelligence", "ok": True}


@api_router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    max_results: int = 20,
    country: Optional[str] = None,
    language: Optional[str] = None,
    min_subs: Optional[int] = None,
    max_subs: Optional[int] = None,
    min_engagement: Optional[float] = None,
    has_email: Optional[bool] = None,
    has_instagram: Optional[bool] = None,
    has_linkedin: Optional[bool] = None,
    has_website: Optional[bool] = None,
    active_days: Optional[int] = None,
    use_ai: bool = True,
    page_token: Optional[str] = None,
    order: str = "relevance",
    search_type: str = "channel",
):
    """Search YouTube channels (by channel name or by video content) then enrich each in parallel."""
    if not YT_API_KEY:
        raise HTTPException(500, "YouTube API key not configured")
    max_results = max(1, min(max_results, 50))
    async with httpx.AsyncClient() as http:
        if search_type == "video":
            # Search by video content — extracts unique channel IDs from video results
            params = {
                "part": "snippet",
                "q": q,
                "type": "video",
                "maxResults": max_results,
            }
            if country:
                params["regionCode"] = country
            if language:
                params["relevanceLanguage"] = language
            if order:
                params["order"] = order
            if page_token:
                params["pageToken"] = page_token
            data = await yt_get(http, "/search", params)
            # For video search, channelId lives in snippet.channelId directly
            ids = [item["snippet"]["channelId"] for item in data.get("items", []) if item.get("snippet", {}).get("channelId")]
            ids = list(dict.fromkeys(ids))  # deduplicate channels that had multiple matching videos
        else:
            # Default: search by channel name/description
            params = {
                "part": "snippet",
                "q": q,
                "type": "channel",
                "maxResults": max_results,
            }
            if country:
                params["regionCode"] = country
            if language:
                params["relevanceLanguage"] = language
            if order:
                params["order"] = order
            if page_token:
                params["pageToken"] = page_token
            data = await yt_get(http, "/search", params)
            ids = [item["snippet"]["channelId"] for item in data.get("items", []) if item.get("snippet", {}).get("channelId")]
            ids = list(dict.fromkeys(ids))

    # Enrich WITHOUT per-channel AI (fast). We'll batch AI at the end.
    sem = asyncio.Semaphore(5)
    async def _enrich(cid: str):
        async with sem:
            try:
                return await get_channel_cached(cid, use_ai=False)
            except Exception as e:
                logger.warning(f"enrich {cid} failed: {e}")
                return None
    results = await asyncio.gather(*[_enrich(cid) for cid in ids])
    results = [r for r in results if r is not None]

    # Batch classify only channels missing niche
    if use_ai:
        to_classify = [c for c in results if not c.niche or c.niche == "Uncategorized"]
        if to_classify:
            payload = [{
                "id": c.channel_id,
                "name": c.name,
                "description": c.description,
                "keywords": c.keywords,
                "titles": [v.get("title") for v in (c.recent_videos or [])[:8]],
            } for c in to_classify]
            classifications = await batch_classify(payload)
            for c in to_classify:
                cls = classifications.get(c.channel_id)
                if cls:
                    c.niche = cls.get("main_niche") or c.niche
                    c.subniches = cls.get("subniches") or c.subniches
                    # persist
                    await db.channels.update_one(
                        {"channel_id": c.channel_id},
                        {"$set": {"niche": c.niche, "subniches": c.subniches}}
                    )

    # Apply filters
    def keep(c: ChannelDetail) -> bool:
        if min_subs is not None and c.subscribers < min_subs: return False
        if max_subs is not None and c.subscribers > max_subs: return False
        if min_engagement is not None and c.engagement_rate < min_engagement: return False
        if has_email and not c.has_email: return False
        if has_instagram and not c.has_instagram: return False
        if has_linkedin and not c.has_linkedin: return False
        if has_website and not c.has_website: return False
        if active_days is not None and c.last_upload:
            dt = iso_to_dt(c.last_upload)
            if dt and (datetime.now(timezone.utc) - dt).days > active_days:
                return False
        return True

    filtered = [c for c in results if keep(c)]
    filtered.sort(key=lambda x: x.prospect_score, reverse=True)

    # Return summaries
    summaries = []
    for c in filtered:
        summaries.append(ChannelSummary(**{
            k: getattr(c, k) for k in ChannelSummary.model_fields.keys()
        }).model_dump())
    return {
        "query": q,
        "count": len(summaries),
        "next_page_token": data.get("nextPageToken"),
        "results": summaries
    }


@api_router.get("/channel/{channel_id}", response_model=ChannelDetail)
async def channel_detail(channel_id: str, use_ai: bool = True):
    return await get_channel_cached(channel_id, use_ai=use_ai)


@api_router.get("/channel/{channel_id}/similar")
async def similar_channels(channel_id: str, limit: int = 8):
    """Find similar channels using YouTube search with the channel's niche + keywords."""
    base = await get_channel_cached(channel_id, use_ai=True)
    query_parts = []
    if base.niche and base.niche != "Uncategorized":
        query_parts.append(base.niche)
    query_parts.extend(base.subniches[:2])
    if not query_parts:
        query_parts.extend(base.keywords[:3])
    q = " ".join(query_parts).strip() or base.name

    async with httpx.AsyncClient() as http:
        data = await yt_get(http, "/search", {
            "part": "snippet", "q": q, "type": "channel", "maxResults": limit + 4
        })
        ids = [it["snippet"]["channelId"] for it in data.get("items", []) if it.get("snippet", {}).get("channelId")]
        ids = [i for i in dict.fromkeys(ids) if i != channel_id][:limit]

    sem = asyncio.Semaphore(4)
    async def _e(cid):
        async with sem:
            try: return await get_channel_cached(cid, use_ai=True)
            except Exception as e:
                logger.warning(f"similar enrich {cid}: {e}"); return None
    enriched = [x for x in await asyncio.gather(*[_e(i) for i in ids]) if x]

    def sim_score(other: ChannelDetail) -> (float, List[str]):
        reasons = []
        s = 0.0
        if other.niche and other.niche == base.niche:
            s += 40; reasons.append(f"Same niche: {base.niche}")
        overlap_sub = set(map(str.lower, base.subniches)) & set(map(str.lower, other.subniches))
        if overlap_sub:
            s += 10 * len(overlap_sub); reasons.append(f"Shared subniches: {', '.join(overlap_sub)}")
        overlap_kw = set(map(str.lower, base.keywords[:15])) & set(map(str.lower, other.keywords[:15]))
        if overlap_kw:
            s += min(20, 3 * len(overlap_kw)); reasons.append(f"{len(overlap_kw)} shared keywords")
        # audience size similarity
        if base.subscribers and other.subscribers:
            ratio = min(base.subscribers, other.subscribers) / max(base.subscribers, other.subscribers)
            s += ratio * 15
            if ratio > 0.5: reasons.append("Similar audience size")
        return min(round(s), 100), reasons

    out = []
    for e in enriched:
        sc, rs = sim_score(e)
        out.append({
            "channel": ChannelSummary(**{k: getattr(e, k) for k in ChannelSummary.model_fields.keys()}).model_dump(),
            "similarity": sc,
            "reasons": rs,
        })
    out.sort(key=lambda x: x["similarity"], reverse=True)
    return {"base_channel_id": channel_id, "results": out}


@api_router.post("/export/csv")
async def export_csv(payload: Dict[str, Any]):
    rows = payload.get("rows", [])
    if not rows:
        raise HTTPException(400, "No rows to export")
    output = io.StringIO()
    fields = ["channel_id","name","handle","country","language","subscribers","total_views","video_count",
              "avg_views_per_video","engagement_rate","uploads_per_month","last_upload",
              "niche","subniches","prospect_score","has_email","has_instagram","has_linkedin","has_website"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        row = {**r}
        if isinstance(row.get("subniches"), list):
            row["subniches"] = "; ".join(row["subniches"])
        writer.writerow(row)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=creators.csv"}
    )


@api_router.post("/export/excel")
async def export_excel(payload: Dict[str, Any]):
    from openpyxl import Workbook
    rows = payload.get("rows", [])
    if not rows:
        raise HTTPException(400, "No rows to export")
    wb = Workbook()
    ws = wb.active
    ws.title = "Creators"
    fields = ["channel_id","name","handle","country","language","subscribers","total_views","video_count",
              "avg_views_per_video","engagement_rate","uploads_per_month","last_upload",
              "niche","subniches","prospect_score","has_email","has_instagram","has_linkedin","has_website"]
    ws.append(fields)
    for r in rows:
        row = []
        for f in fields:
            v = r.get(f)
            if isinstance(v, list): v = "; ".join(map(str, v))
            row.append(v)
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=creators.xlsx"}
    )


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
