"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import type { FoodLog } from "@/lib/nutrition";
import { authEnabled, deleteFoodLog, foodLogError, loadFoodLogs, saveFoodLog } from "@/lib/supabase";

/** Guests' logs for this page load: memory only, so they survive switching tabs but not a reload. */
let guestLogs: Record<string, FoodLog> = {};

/** Food logs by ISO date. Signed in: loaded from and saved to the account for `from`–`to`.
 *  Guests: kept in memory only (never in localStorage), so they're gone on reload. */
export function useFoodLogs(from: string, to: string) {
  const { user } = useApp();
  const signedIn = !!user && authEnabled;
  const [logs, setLogs] = useState<Record<string, FoodLog>>(() => (signedIn ? {} : guestLogs));
  const userId = useRef(user?.id);
  userId.current = user?.id;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // A different account (or signing out) starts from a clean slate.
  const lastUser = useRef(user?.id);
  useEffect(() => {
    if (lastUser.current === user?.id) return;
    lastUser.current = user?.id;
    guestLogs = {};
    setLogs({});
  }, [user?.id]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    setLoading(true);
    loadFoodLogs(from, to)
      .then((rows) => { if (!cancelled) setLogs((cur) => ({ ...cur, ...Object.fromEntries(rows.map((r) => [r.date, r])) })); })
      .catch((e) => { if (!cancelled) toast.error(foodLogError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [signedIn, from, to, user?.id]);

  const save = useCallback(async (log: FoodLog) => {
    if (!signedIn || !user) { guestLogs = { ...guestLogs, [log.date]: log }; setLogs(guestLogs); return true; }
    setSaving(true);
    try {
      await saveFoodLog(user.id, log);
      if (userId.current !== user.id) return false; // signed out or switched account meanwhile
      setLogs((cur) => ({ ...cur, [log.date]: log }));
      toast.success("Day saved");
      return true;
    } catch (e) {
      toast.error(foodLogError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [signedIn, user]);

  const remove = useCallback(async (date: string) => {
    const drop = (cur: Record<string, FoodLog>) => { const next = { ...cur }; delete next[date]; return next; };
    if (!signedIn || !user) { guestLogs = drop(guestLogs); setLogs(guestLogs); return true; }
    setSaving(true);
    try {
      await deleteFoodLog(date);
      if (userId.current !== user.id) return false;
      setLogs(drop);
      toast.success("Day deleted");
      return true;
    } catch (e) {
      toast.error(foodLogError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [signedIn, user]);

  return { logs, save, remove, loading, saving, signedIn };
}
