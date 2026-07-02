import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import AppShell from "@/components/AppShell";
import SearchPage from "@/pages/SearchPage";
import ChannelDetailPage from "@/pages/ChannelDetailPage";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/channel/:channelId" element={<ChannelDetailPage />} />
          </Routes>
        </AppShell>
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </div>
  );
}

export default App;
