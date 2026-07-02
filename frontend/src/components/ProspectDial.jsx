import React from "react";
import { scoreColor } from "../lib/apiClient";

export default function ProspectDial({ score = 0, size = 96, showLabel = true, testId = "prospect-dial" }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const color = scoreColor(s);
  return (
    <div className="flex items-center gap-3" data-testid={testId}>
      <div
        className="score-dial relative flex items-center justify-center"
        style={{
          width: size,
          height: size,
          "--score-pct": `${s}%`,
          "--score-color": color,
          borderRadius: "50%",
        }}
      >
        <div className="bg-white flex flex-col items-center justify-center" style={{ width: size - 16, height: size - 16, borderRadius: "50%" }}>
          <div className="font-heading font-black text-2xl leading-none" style={{ color }}>{s}</div>
          {showLabel && <div className="overline mt-1" style={{ fontSize: "0.55rem" }}>/ 100</div>}
        </div>
      </div>
    </div>
  );
}
