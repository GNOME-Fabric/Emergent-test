import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, fmtNumber, fmtPct, fmtDate, scoreColor, daysAgo } from "../lib/apiClient";
import ProspectDial from "../components/ProspectDial";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  ArrowLeft, Mail, Instagram, Linkedin, Globe, Youtube, Twitter, Facebook,
  MessageCircle, Twitch, Send, ExternalLink, TrendingUp, Users, PlayCircle,
  Calendar, Zap, Award, Sparkles
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { toast } from "sonner";

const PLATFORM_ICON = {
  instagram: Instagram, twitter: Twitter, linkedin: Linkedin, facebook: Facebook,
  tiktok: MessageCircle, discord: MessageCircle, telegram: Send, twitch: Twitch,
  kick: PlayCircle,
};

export default function ChannelDetailPage() {
  const { channelId } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/channel/${channelId}`);
        if (!cancel) setData(data);
      } catch (e) {
        toast.error("Failed to load channel");
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [channelId]);

  const loadSimilar = async () => {
    if (similar) return;
    setSimLoading(true);
    try {
      const { data } = await api.get(`/channel/${channelId}/similar`);
      setSimilar(data.results || []);
    } catch { toast.error("Failed to load similar channels"); }
    finally { setSimLoading(false); }
  };

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="col-span-4">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-10 text-center">Channel not found.</div>;

  const c = data;
  const contentMixArr = Object.entries(c.content_mix || {}).map(([k, v]) => ({ name: k, value: v }));
  const trend = (c.monthly_views_trend || []).slice(-12);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8" data-testid="channel-detail">
      <button onClick={() => nav(-1)} data-testid="back-link" className="flex items-center gap-1 text-sm text-zinc-600 hover:text-black mb-4">
        <ArrowLeft size={14} /> Back to results
      </button>

      {/* Header */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 lg:col-span-8 bg-white border border-[#E4E4E7] p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <img src={c.thumbnail || "https://images.unsplash.com/photo-1573497161161-c3e73707e25c?w=200"} alt="" className="w-24 h-24 object-cover rounded-full border border-zinc-200" />
            <div className="flex-1 min-w-0">
              <div className="overline text-[#E60000] mb-1">YouTube · {c.country || "Global"}</div>
              <h1 className="font-heading font-black text-3xl sm:text-4xl leading-tight tracking-tight mb-2">{c.name}</h1>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className="rounded-none bg-[#09090B] text-white">{c.niche || "Uncategorized"}</Badge>
                {(c.subniches || []).map(s => (
                  <Badge key={s} variant="outline" className="rounded-none border-zinc-300">{s}</Badge>
                ))}
              </div>
              <p className="text-sm text-zinc-600 line-clamp-3 max-w-2xl leading-relaxed">
                {c.description || "No description available."}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-zinc-500">
                <span>Created {fmtDate(c.created_at)}</span>
                <span>·</span>
                <span>Last upload {c.last_upload ? `${daysAgo(c.last_upload)}d ago` : "—"}</span>
                <span>·</span>
                <a href={`https://youtube.com/channel/${c.channel_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-black">
                  <Youtube size={12} /> Open channel <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Prospect Score card */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-[#E4E4E7] p-6" data-testid="prospect-score-card">
          <div className="overline mb-3 flex items-center gap-2"><Award size={12} /> Prospect Score</div>
          <div className="flex items-center gap-5">
            <ProspectDial score={c.prospect_score} size={110} />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Verdict</div>
              <div className="font-heading font-bold text-lg mb-2" style={{ color: scoreColor(c.prospect_score) }}>
                {c.prospect_score >= 80 ? "High priority" : c.prospect_score >= 50 ? "Worth reaching" : "Low priority"}
              </div>
              <ul className="text-xs space-y-1 text-zinc-600">
                {(c.prospect_reasons || []).slice(0, 4).map((r, i) => (
                  <li key={i} className="flex gap-1.5"><Sparkles size={11} className="mt-0.5 text-[#002BF6] flex-shrink-0" /><span>{r}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 border border-[#E4E4E7] bg-white mb-8" data-testid="metric-strip">
        <Metric label="Subscribers" value={fmtNumber(c.subscribers)} icon={Users} />
        <Metric label="Total views" value={fmtNumber(c.total_views)} icon={PlayCircle} />
        <Metric label="Videos" value={fmtNumber(c.video_count)} />
        <Metric label="Avg views / video" value={fmtNumber(c.avg_views_per_video)} icon={TrendingUp} />
        <Metric label="Avg (last 10)" value={fmtNumber(c.avg_views_last10)} />
        <Metric label="Engagement" value={fmtPct(c.engagement_rate)} icon={Zap} accent />
        <Metric label="Uploads / mo" value={c.uploads_per_month?.toFixed?.(1) ?? "—"} icon={Calendar} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="rounded-none bg-transparent border-b border-[#E4E4E7] w-full justify-start p-0 h-auto">
          {[
            ["overview", "Overview"], ["socials", "Socials & Contact"],
            ["content", "Content mix"], ["videos", "Recent videos"], ["similar", "Similar creators"],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v} data-testid={`tab-${v}`}
              onClick={v === "similar" ? loadSimilar : undefined}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#002BF6] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 font-semibold text-zinc-600 data-[state=active]:text-black">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 bg-white border border-[#E4E4E7] p-6">
              <div className="overline mb-4">Monthly views trend (recent videos)</div>
              {trend.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                    <XAxis dataKey="month" stroke="#71717A" fontSize={11} />
                    <YAxis stroke="#71717A" fontSize={11} tickFormatter={fmtNumber} />
                    <Tooltip formatter={(v) => fmtNumber(v)} contentStyle={{ borderRadius: 0, border: "1px solid #E4E4E7", fontFamily: "'JetBrains Mono', monospace" }} />
                    <Line type="monotone" dataKey="views" stroke="#002BF6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="text-sm text-zinc-500">Not enough data.</div>}
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <TopicsBlock title="Top topics" items={(c.top_topics || []).map(t => `${t.topic}${t.weight ? ` · ${t.weight}` : ""}`)} />
              <TopicsBlock title="Brands mentioned" items={c.top_brands || []} />
              <TopicsBlock title="Products mentioned" items={c.top_products || []} />
              <TopicsBlock title="Software mentioned" items={c.top_software || []} />
              <TopicsBlock title="Keywords" items={c.keywords || []} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="socials" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-6 bg-white border border-[#E4E4E7] p-6" data-testid="socials-block">
              <div className="overline mb-4">Discovered social profiles</div>
              {(c.social_links || []).length === 0 && <div className="text-sm text-zinc-500">No public social links discovered.</div>}
              <ul className="space-y-2">
                {(c.social_links || []).map((s, i) => {
                  const Icon = PLATFORM_ICON[s.platform] || Globe;
                  return (
                    <li key={i} className="flex items-center justify-between border border-[#E4E4E7] px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={14} className="text-[#09090B] flex-shrink-0" />
                        <span className="uppercase text-xs tracking-widest font-semibold text-zinc-500 w-20">{s.platform}</span>
                        <span className="font-mono text-xs truncate">@{s.username}</span>
                      </div>
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-[#002BF6] hover:underline flex items-center gap-1">Open <ExternalLink size={10} /></a>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="col-span-12 lg:col-span-6 bg-white border border-[#E4E4E7] p-6" data-testid="contacts-block">
              <div className="overline mb-4">Contact intelligence</div>
              {(c.contacts || []).length === 0 && <div className="text-sm text-zinc-500">No public contact clues found.</div>}
              <ul className="space-y-2">
                {(c.contacts || []).map((k, i) => (
                  <li key={i} className="flex items-center justify-between border border-[#E4E4E7] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {k.type === "email" ? <Mail size={14} /> : k.type === "website" ? <Globe size={14} /> : k.type === "linkedin" ? <Linkedin size={14} /> : <Instagram size={14} />}
                      <span className="uppercase text-[10px] tracking-widest font-semibold text-zinc-500 w-24">{k.type.replace("_", " ")}</span>
                      <span className="font-mono text-xs truncate flex-1">{k.value}</span>
                    </div>
                    <Badge className="rounded-none text-[10px]" style={{ background: k.confidence === "high" ? "#16A34A" : "#D97706", color: "white" }}>
                      {k.confidence}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-6 bg-white border border-[#E4E4E7] p-6">
              <div className="overline mb-4">Content mix</div>
              {contentMixArr.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={contentMixArr}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                    <XAxis dataKey="name" stroke="#71717A" fontSize={11} />
                    <YAxis stroke="#71717A" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #E4E4E7" }} />
                    <Bar dataKey="value" fill="#002BF6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-sm text-zinc-500">Not analyzed.</div>}
            </div>
            <div className="col-span-12 lg:col-span-6 bg-white border border-[#E4E4E7] p-6">
              <div className="overline mb-4">Audience quality</div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <QualityRow label="Avg likes" v={fmtNumber(c.avg_likes)} />
                <QualityRow label="Avg comments" v={fmtNumber(c.avg_comments)} />
                <QualityRow label="Views / like" v={c.avg_likes ? (c.avg_views_last30 / c.avg_likes).toFixed(1) : "—"} />
                <QualityRow label="Views / comment" v={c.avg_comments ? (c.avg_views_last30 / c.avg_comments).toFixed(1) : "—"} />
                <QualityRow label="Uploads / week" v={c.uploads_per_week?.toFixed?.(1) ?? "—"} />
                <QualityRow label="Sub / view ratio" v={c.total_views ? (c.subscribers / c.total_views).toFixed(3) : "—"} />
              </dl>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="recent-videos-grid">
            {(c.recent_videos || []).map(v => (
              <a key={v.video_id} href={`https://youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer" className="bg-white border border-[#E4E4E7] overflow-hidden group">
                <div className="aspect-video bg-zinc-100 overflow-hidden">
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                </div>
                <div className="p-3">
                  <div className="text-xs font-semibold line-clamp-2 mb-2 min-h-[2.5rem]">{v.title}</div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>{fmtNumber(v.views)} views</span>
                    <span>{daysAgo(v.published_at)}d</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="similar" className="mt-6">
          {simLoading && <div className="text-sm text-zinc-500">Analyzing similar creators…</div>}
          {similar && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="similar-grid">
              {similar.map((s) => (
                <Link key={s.channel.channel_id} to={`/channel/${s.channel.channel_id}`} className="bg-white border border-[#E4E4E7] p-4 block hover:border-black transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={s.channel.thumbnail} className="w-10 h-10 rounded-full object-cover" alt="" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{s.channel.name}</div>
                      <div className="text-xs text-zinc-500">{fmtNumber(s.channel.subscribers)} subs · {s.channel.niche || "—"}</div>
                    </div>
                    <div className="font-mono text-lg font-bold" style={{ color: scoreColor(s.similarity) }}>{s.similarity}</div>
                  </div>
                  <ul className="text-xs text-zinc-600 space-y-1">
                    {(s.reasons || []).slice(0, 3).map((r, i) => (<li key={i}>· {r}</li>))}
                  </ul>
                </Link>
              ))}
            </div>
          )}
          {!similar && !simLoading && (
            <Button data-testid="load-similar-btn" onClick={loadSimilar} className="rounded-none">Find similar creators</Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }) {
  return (
    <div className="px-4 py-4 border-r border-b border-[#E4E4E7] last:border-r-0">
      <div className="overline mb-1 flex items-center gap-1">{Icon && <Icon size={11} />}{label}</div>
      <div className={`font-mono font-bold text-lg ${accent ? "text-[#002BF6]" : ""}`}>{value}</div>
    </div>
  );
}

function TopicsBlock({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white border border-[#E4E4E7] p-4">
      <div className="overline mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 12).map((t, i) => (
          <span key={i} className="px-2 py-0.5 text-xs border border-zinc-300 bg-[#FAFAFA] font-mono">{t}</span>
        ))}
      </div>
    </div>
  );
}

function QualityRow({ label, v }) {
  return (
    <div>
      <div className="overline mb-0.5">{label}</div>
      <div className="font-mono font-semibold">{v}</div>
    </div>
  );
}
