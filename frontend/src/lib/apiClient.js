import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const REQUEST_TIMEOUT_MS = 120000;
const SECONDS_PER_DAY = 86400;

export const api = axios.create({
  baseURL: API,
  timeout: REQUEST_TIMEOUT_MS,
});

export function fmtNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

export function fmtPct(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${Number(n).toFixed(digits)}%`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch { return "—"; }
}

export function daysAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (SECONDS_PER_DAY * 1000));
}

export function scoreColor(s) {
  if (s >= 80) return "#16A34A";
  if (s >= 50) return "#D97706";
  return "#DC2626";
}
