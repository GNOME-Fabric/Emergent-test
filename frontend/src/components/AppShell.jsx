import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Radar, LayoutGrid, Github } from "lucide-react";

export default function AppShell({ children }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#09090B]">
      <header className="sticky top-0 z-40 bg-white border-b border-[#E4E4E7]" data-testid="app-header">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
            <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
              <Radar size={16} className="text-[#E60000]" strokeWidth={2.5} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-black text-lg tracking-tight">CREATOR.OS</span>
              <span className="overline hidden sm:inline">/ YouTube Intelligence</span>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" data-testid="nav-search" className={`px-3 py-1.5 hover:bg-zinc-100 flex items-center gap-2 ${loc.pathname === "/" ? "bg-zinc-100 font-semibold" : ""}`}>
              <LayoutGrid size={14} /> Search
            </Link>
            <a href="https://developers.google.com/youtube/v3" target="_blank" rel="noreferrer" className="px-3 py-1.5 hover:bg-zinc-100 flex items-center gap-2 text-zinc-600">
              <Github size={14} /> API v3
            </a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-[#E4E4E7] bg-white mt-16">
        <div className="max-w-[1600px] mx-auto px-6 py-6 flex items-center justify-between text-xs">
          <span className="overline">Creator.OS &middot; Prospect intelligence for YouTube</span>
          <span className="font-mono text-zinc-500">v0.1</span>
        </div>
      </footer>
    </div>
  );
}
