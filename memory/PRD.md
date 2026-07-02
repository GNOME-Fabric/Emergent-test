# PRD - Creator.OS (YouTube Creator Intelligence Platform)

## Original Problem Statement
Advanced YouTube creator prospecting & intelligence platform. Search any niche and instantly get a ranked list of qualified YouTube creators with metrics, niche, growth, socials, contact clues, prospect score and similarity — a mix of Apollo + Clay + Sales Navigator + Social Blade but YouTube-native.

## User Choices
- YouTube Data API v3 key provided by user.
- AI: OpenAI GPT-5.2 via Emergent LLM Key.
- Scope: search + listing + filters + scoring + channel details (contacts by web crawling deferred).
- Auth: None (public MVP).
- UI: English.

## Personas
- B2B outbound / partnerships teams sourcing YouTube creators for outreach.
- Growth marketers running influencer campaigns.
- Founders identifying niche experts for partnerships.

## Architecture (implemented)
- FastAPI backend (`/app/backend/server.py`) with MongoDB for channel enrichment cache (24h TTL).
- YouTube Data API v3 → channels + playlistItems + videos.
- GPT-5.2 batch niche classification (single LLM call per search).
- Per-channel AI enrichment on detail page (main niche, subniches, topics, brands, products, software, content mix, keywords).
- Social link + email + website regex extraction from channel & video descriptions.
- Prospect score 0-100 with reason list (authority, engagement, cadence, activity, view velocity, contactability, multi-channel presence).
- Similar creators via YouTube search + niche/keyword overlap heuristic.
- CSV & XLSX exports.
- React 19 + shadcn/ui + Tailwind. Design: Swiss & High-Contrast (Archetype 4) with Chivo + IBM Plex Sans + JetBrains Mono.

## Implemented (as of 2026-07-02)
- `/api/search` with filters: country, language, min/max subs, min engagement, active days, has_email/instagram/linkedin/website.
- `/api/channel/{id}` with full detail + AI classification + cache.
- `/api/channel/{id}/similar` with similarity scoring & reasons.
- `/api/export/csv` and `/api/export/excel`.
- SearchPage: hero, search bar, niche chips, filter sidebar, dense results table with score chips.
- ChannelDetailPage: hero, Prospect Score dial card, metric strip, 5 tabs (Overview, Socials & Contact, Content mix, Recent videos, Similar creators), Recharts.

## Backlog / Next
- P1: Deep contact enrichment via crawling personal/company websites (Hunter-style).
- P1: Save-to-list feature (persistent prospect lists in Mongo, tagging, notes).
- P1: HubSpot / Salesforce / Airtable / Google Sheets exports.
- P2: Bulk import of channel IDs; batch enrichment queue.
- P2: Comment-based audience sentiment & language distribution.
- P2: Growth trend series (historical subs / views via periodic snapshots).
- P2: Email verification (SMTP catch-all check).
- P3: Team seats + auth (Emergent Google Auth).
