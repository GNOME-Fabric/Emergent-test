import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Download, ArrowUpRight, Mail, Instagram, Linkedin, Globe, Loader2 } from "lucide-react";
import { api, fmtNumber, fmtPct, fmtDate, scoreColor } from "../lib/apiClient";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";

const COUNTRIES = [
  { v: "", n: "Any country" }, { v: "US", n: "United States" }, { v: "BR", n: "Brazil" },
  { v: "GB", n: "United Kingdom" }, { v: "IN", n: "India" }, { v: "CA", n: "Canada" },
  { v: "DE", n: "Germany" }, { v: "FR", n: "France" }, { v: "ES", n: "Spain" },
  { v: "MX", n: "Mexico" }, { v: "JP", n: "Japan" }, { v: "AU", n: "Australia" },
];
const LANGUAGES = [
  { v: "", n: "Any language" }, { v: "en", n: "English" }, { v: "pt", n: "Portuguese" },
  { v: "es", n: "Spanish" }, { v: "fr", n: "French" }, { v: "de", n: "German" },
  { v: "hi", n: "Hindi" }, { v: "ja", n: "Japanese" },
];
const SAMPLE_NICHES = ["ai automation", "youtube automation", "digital marketing", "crypto", "trading", "fitness coach", "saas founder", "personal finance", "gaming", "productivity"];

export default function SearchPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);

  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [minSubs, setMinSubs] = useState("");
  const [maxSubs, setMaxSubs] = useState("");
  const [minEng, setMinEng] = useState("");
  const [activeDays, setActiveDays] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasInsta, setHasInsta] = useState(false);
  const [hasLinkedin, setHasLinkedin] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [order, setOrder] = useState("relevance");
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const runSearch = async (query) => {
    const term = (query ?? q).trim();
    if (!term) { toast.error("Enter a keyword, niche, or creator to search"); return; }
    setLoading(true);
    setResults([]);
    setNextPageToken(null);
    try {
      const params = { q: term, max_results: 50 };
      if (order) params.order = order;
      if (country && country !== "any") params.country = country;
      if (language && language !== "any") params.language = language;
      if (minSubs) params.min_subs = Number(minSubs);
      if (maxSubs) params.max_subs = Number(maxSubs);
      if (minEng) params.min_engagement = Number(minEng);
      if (activeDays && activeDays !== "any") params.active_days = Number(activeDays);
      if (hasEmail) params.has_email = true;
      if (hasInsta) params.has_instagram = true;
      if (hasLinkedin) params.has_linkedin = true;
      if (hasWebsite) params.has_website = true;

      const { data } = await api.get("/search", { params });
      setResults(data.results || []);
      setNextPageToken(data.next_page_token || null);
      setMeta({ q: data.query, count: data.count });
      if ((data.results || []).length === 0) {
        toast.info("No creators matched your filters. Try loosening constraints.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextPageToken || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = { q: q.trim(), max_results: 50, page_token: nextPageToken };
      if (order) params.order = order;
      if (country && country !== "any") params.country = country;
      if (language && language !== "any") params.language = language;
      if (minSubs) params.min_subs = Number(minSubs);
      if (maxSubs) params.max_subs = Number(maxSubs);
      if (minEng) params.min_engagement = Number(minEng);
      if (activeDays && activeDays !== "any") params.active_days = Number(activeDays);
      if (hasEmail) params.has_email = true;
      if (hasInsta) params.has_instagram = true;
      if (hasLinkedin) params.has_linkedin = true;
      if (hasWebsite) params.has_website = true;

      const { data } = await api.get("/search", { params });
      setResults(prev => [...prev, ...(data.results || [])]);
      setNextPageToken(data.next_page_token || null);
      setMeta(prev => prev ? { ...prev, count: prev.count + (data.results || []).length } : { q: q, count: (data.results || []).length });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load more results");
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    if (!results.length) { toast.error("Nothing to export yet"); return; }
    try {
      const res = await api.post("/export/csv", { rows: results }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "creators.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported CSV");
    } catch { toast.error("Export failed"); }
  };
  const exportXlsx = async () => {
    if (!results.length) { toast.error("Nothing to export yet"); return; }
    try {
      const res = await api.post("/export/excel", { rows: results }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "creators.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported Excel");
    } catch { toast.error("Export failed"); }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      {/* Hero */}
      <section className="mb-8 border-b border-[#E4E4E7] pb-8" data-testid="hero-section">
        <div className="overline mb-3">Prospect Intelligence &middot; YouTube-native</div>
        <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-4">
          Find the creators<br />worth reaching out to.
        </h1>
        <p className="max-w-2xl text-zinc-600 text-base sm:text-lg leading-relaxed">
          Search any niche and get an instant, ranked list of qualified YouTube creators — enriched with metrics, socials, contact clues and a prospect score from 0 to 100.
        </p>

        {/* Search bar */}
        <div className="mt-8 flex flex-col sm:flex-row gap-2 max-w-3xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              data-testid="search-input"
              placeholder='Try "ai automation", "saas founder", "personal finance"…'
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-9 h-12 rounded-none border-zinc-300 bg-white focus-visible:ring-2 focus-visible:ring-[#002BF6] focus-visible:ring-offset-1"
            />
          </div>
          <Button
            data-testid="search-submit"
            onClick={() => runSearch()}
            disabled={loading}
            className="h-12 px-6 rounded-none bg-[#09090B] hover:bg-[#002BF6] text-white font-semibold"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Search creators"}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="overline mr-1">Try:</span>
          {SAMPLE_NICHES.map((s) => (
            <button
              key={s}
              data-testid={`chip-${s.replace(/\s+/g, "-")}`}
              onClick={() => { setQ(s); runSearch(s); }}
              className="px-2.5 py-1 border border-zinc-300 hover:bg-[#09090B] hover:text-white hover:border-[#09090B] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Grid: filters + results */}
      <section className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <div className="bg-white border border-[#E4E4E7] sticky top-20">
            <div className="px-4 py-3 border-b border-[#E4E4E7] flex items-center gap-2">
              <Filter size={14} />
              <span className="overline">Advanced filters</span>
            </div>
            <div className="p-4 space-y-5">
              <FilterBlock label="YouTube Search Order">
                <Select value={order} onValueChange={setOrder}>
                  <SelectTrigger data-testid="filter-order" className="rounded-none h-9"><SelectValue placeholder="Relevance" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="viewCount">View Count</SelectItem>
                    <SelectItem value="videoCount">Video Count</SelectItem>
                    <SelectItem value="date">Date (Newest)</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
              </FilterBlock>

              <FilterBlock label="Country">
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger data-testid="filter-country" className="rounded-none h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c.v || "any"} value={c.v || "any"}>{c.n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterBlock>
              <FilterBlock label="Language">
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger data-testid="filter-language" className="rounded-none h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(c => <SelectItem key={c.v || "any"} value={c.v || "any"}>{c.n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterBlock>

              <FilterBlock label="Subscribers">
                <div className="flex gap-2">
                  <Input data-testid="filter-min-subs" placeholder="Min" value={minSubs} onChange={e => setMinSubs(e.target.value.replace(/\D/g, ""))} className="rounded-none h-9" />
                  <Input data-testid="filter-max-subs" placeholder="Max" value={maxSubs} onChange={e => setMaxSubs(e.target.value.replace(/\D/g, ""))} className="rounded-none h-9" />
                </div>
              </FilterBlock>

              <FilterBlock label="Min engagement (%)">
                <Input data-testid="filter-min-engagement" placeholder="e.g. 2" value={minEng} onChange={e => setMinEng(e.target.value)} className="rounded-none h-9" />
              </FilterBlock>

              <FilterBlock label="Recently active">
                <Select value={activeDays} onValueChange={setActiveDays}>
                  <SelectTrigger data-testid="filter-active-days" className="rounded-none h-9"><SelectValue placeholder="Anytime" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Anytime</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </FilterBlock>

              <FilterBlock label="Contact availability">
                <div className="space-y-2">
                  {[
                    { l: "Has public email", v: hasEmail, s: setHasEmail, id: "filter-has-email" },
                    { l: "Has Instagram", v: hasInsta, s: setHasInsta, id: "filter-has-instagram" },
                    { l: "Has LinkedIn", v: hasLinkedin, s: setHasLinkedin, id: "filter-has-linkedin" },
                    { l: "Has website", v: hasWebsite, s: setHasWebsite, id: "filter-has-website" },
                  ].map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox data-testid={c.id} checked={c.v} onCheckedChange={c.s} className="rounded-none border-zinc-400" />
                      <span>{c.l}</span>
                    </label>
                  ))}
                </div>
              </FilterBlock>

              <Button data-testid="apply-filters-btn" onClick={() => runSearch()} className="w-full rounded-none bg-[#002BF6] hover:bg-[#001FD1] text-white">
                Apply filters
              </Button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="col-span-12 lg:col-span-9">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-heading font-bold text-xl">Results</h2>
              {meta && (
                <span className="overline" data-testid="results-meta">
                  {meta.count} creators &middot; &ldquo;{meta.q}&rdquo;
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} data-testid="export-csv-btn" className="rounded-none h-9 border-zinc-300">
                <Download size={14} className="mr-1" /> CSV
              </Button>
              <Button variant="outline" onClick={exportXlsx} data-testid="export-excel-btn" className="rounded-none h-9 border-zinc-300">
                <Download size={14} className="mr-1" /> Excel
              </Button>
            </div>
          </div>

          <div className="bg-white border border-[#E4E4E7]" data-testid="results-table">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 border-b border-[#E4E4E7] bg-[#FAFAFA]">
              <div className="col-span-4 overline">Creator</div>
              <div className="col-span-2 overline text-right">Subs</div>
              <div className="col-span-2 overline text-right">Engagement</div>
              <div className="col-span-2 overline">Niche</div>
              <div className="col-span-1 overline text-center">Contact</div>
              <div className="col-span-1 overline text-right">Score</div>
            </div>

            {loading && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skel-${i}`} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            )}

            {!loading && results.length === 0 && !meta && (
              <div className="p-10 text-center">
                <div className="overline mb-2">No search yet</div>
                <p className="text-sm text-zinc-600 max-w-md mx-auto">
                  Search for any niche or topic to discover, enrich and rank YouTube creators for outreach.
                </p>
              </div>
            )}

            {!loading && results.length === 0 && meta && (
              <div className="p-10 text-center">
                <div className="overline mb-2">No matches</div>
                <p className="text-sm text-zinc-600">Try broader keywords or fewer filters.</p>
              </div>
            )}

            {!loading && results.map((c) => (
              <button
                key={c.channel_id}
                onClick={() => nav(`/channel/${c.channel_id}`)}
                data-testid={`result-row-${c.channel_id}`}
                className="w-full grid grid-cols-12 gap-3 px-4 py-3 border-b border-[#E4E4E7] row-hover text-left"
              >
                <div className="col-span-12 md:col-span-4 flex items-center gap-3 min-w-0">
                  <img
                    src={c.thumbnail || "https://images.unsplash.com/photo-1573497161161-c3e73707e25c?w=100"}
                    alt="" className="w-10 h-10 object-cover rounded-full border border-zinc-200 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-zinc-500 truncate">
                      {c.handle ? `${c.handle} · ` : ""}{c.country || "—"} {c.language ? ` · ${c.language}` : ""}
                    </div>
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2 text-right font-mono text-sm">{fmtNumber(c.subscribers)}</div>
                <div className="col-span-4 md:col-span-2 text-right font-mono text-sm">{fmtPct(c.engagement_rate)}</div>
                <div className="col-span-4 md:col-span-2">
                  <Badge variant="outline" className="rounded-none border-zinc-300 text-xs">
                    {c.niche || "—"}
                  </Badge>
                </div>
                <div className="col-span-6 md:col-span-1 flex items-center justify-center gap-1 text-zinc-500">
                  {c.has_email && <Mail size={13} className="text-[#002BF6]" title="Has email" />}
                  {c.has_instagram && <Instagram size={13} title="Has Instagram" />}
                  {c.has_linkedin && <Linkedin size={13} title="Has LinkedIn" />}
                  {c.has_website && <Globe size={13} title="Has website" />}
                </div>
                <div className="col-span-6 md:col-span-1 flex items-center justify-end gap-1">
                  <div
                    data-testid={`score-${c.channel_id}`}
                    className="px-2 py-1 font-mono text-sm font-bold"
                    style={{ background: scoreColor(c.prospect_score), color: "white" }}
                  >
                    {c.prospect_score}
                  </div>
                  <ArrowUpRight size={14} className="text-zinc-400" />
                </div>
              </button>
            ))}
          </div>

          {nextPageToken && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-none bg-[#09090B] hover:bg-[#002BF6] text-white font-semibold min-w-[200px]"
              >
                {loadingMore ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {loadingMore ? "Loading..." : "Load More Creators"}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterBlock({ label, children }) {
  return (
    <div>
      <div className="overline mb-1.5">{label}</div>
      {children}
    </div>
  );
}
