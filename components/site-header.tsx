"use client";

import { LogOut, UserRound } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { authEnabled } from "@/lib/supabase";

/** Two-line wordmark: Haji Training Block, with the method underneath. */
export function Wordmark() {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-9 w-10 shrink-0 items-center justify-center rounded-md bg-signal font-display text-[0.9375rem] leading-none tracking-tight font-black text-signal-foreground" aria-hidden>
        H<span className="font-extralight">/</span>T
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-[0.9375rem] leading-6 font-black tracking-tight sm:text-[1.125rem] md:text-[1.25rem]">
          Haji <span className="font-extralight text-signal">·</span> Training Block
        </span>
        <span className="text-meta uppercase text-hero-muted">HYROX + Norwegian Singles</span>
      </span>
    </span>
  );
}

/** Graphite band with the wordmark and who's using the planner. */
export function SiteHeader({ showAccount = true }: { showAccount?: boolean }) {
  const { user, entry, signOut, goHome } = useApp();
  const name = (user?.user_metadata?.display_name as string | undefined) || user?.email || "Guest";
  return (
    <header className="bg-hero text-hero-foreground no-print pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-[max(16px,env(safe-area-inset-left))] md:px-8">
        <a href="#paces" className="min-w-0" aria-label="Haji Training Block">
          <Wordmark />
        </a>
        {showAccount && entry && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden min-w-0 items-center gap-2 text-hero-muted md:flex">
              <UserRound className="size-4 shrink-0" aria-hidden />
              <span className="max-w-[24ch] truncate">{name}</span>
            </span>
            <button
              type="button"
              onClick={() => (user ? signOut() : goHome())}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-hero-muted/40 px-3 sm:px-4 text-hero-foreground hover:bg-hero-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-foreground"
            >
              {user ? <><LogOut className="size-4" aria-hidden /> Sign out</> : authEnabled ? "Sign in" : "Home"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
