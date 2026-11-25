"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { healthRead, type HealthData } from "@/lib/health";

/** How often Health Connect data is checked while the page is open (the phone sends every 15 min or more). */
const POLL_MS = 5 * 60 * 1000;

/** Loads Health Connect data for the Weight and Sleep cards, and keeps it fresh. */
export function useHealth(key: string | undefined) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const seq = useRef(0); // only the newest request may update the cards

  const load = useCallback(async (auto = false) => {
    if (!key || (auto && Date.now() - last.current < 60000)) return;
    last.current = Date.now();
    const id = ++seq.current;
    setBusy(true);
    try {
      const d = await healthRead(key);
      if (id === seq.current) { setData(d); setError(""); }
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, [key]);

  useEffect(() => {
    setData(null); setError("");
    load();
    const onShow = () => { if (document.visibilityState === "visible") load(true); };
    const timer = setInterval(onShow, POLL_MS);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { seq.current++; last.current = 0; clearInterval(timer); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, [load]);

  return { data, error, busy, reload: () => load() };
}

