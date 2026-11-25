"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { localHealthKey, saveLocalHealthKey } from "@/lib/health";

/** The Health Connect sync key: saved with the account when signed in, and on this device for everyone. */
export function useHealthKey() {
  const { settings, update, saveState } = useApp();
  const [local, setLocal] = useState("");
  useEffect(() => { setLocal(localHealthKey()); }, []);
  const ready = saveState !== "loading";
  const key = settings.healthKey || local;

  useEffect(() => {
    if (!ready) return;
    if (settings.healthKey && settings.healthKey !== local) { saveLocalHealthKey(settings.healthKey); setLocal(settings.healthKey); }
    // A key made as a guest (or on this device) joins the account once it has loaded.
    else if (!settings.healthKey && local && saveState !== "guest") update({ healthKey: local });
  }, [ready, saveState, settings.healthKey, local, update]);

  const setKey = (k: string) => { saveLocalHealthKey(k); setLocal(k); update({ healthKey: k }); };
  return { key, setKey, ready };
}
