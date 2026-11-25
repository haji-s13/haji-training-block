"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "htb-open-card";

/** Opens a collapsed card by id (e.g. before scrolling to it). */
export function openCard(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
}

/** A card whose body folds away under its title. Open or closed is remembered on this device. */
export function CollapsibleCard({ id, storageKey, title, icon, status, summary, defaultOpen = true, className, contentClassName, children }: {
  id?: string;
  storageKey: string;
  title: ReactNode;
  icon?: ReactNode;
  /** Always shown at the right of the title row (e.g. "Connected"). */
  status?: ReactNode;
  /** Shown under the title while the card is closed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const key = `htb-card-${storageKey}`;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try { const v = localStorage.getItem(key); if (v !== null) setOpen(v === "1"); } catch { /* ignore */ }
  }, [key]);
  const toggle = (o: boolean) => { setOpen(o); try { localStorage.setItem(key, o ? "1" : "0"); } catch { /* ignore */ } };
  useEffect(() => {
    if (!id) return;
    const on = (e: Event) => { if ((e as CustomEvent).detail === id) toggle(true); };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  });

  return (
    <Collapsible id={id} open={open} onOpenChange={toggle} className={cn("scroll-mt-8 rounded-lg border bg-card", className)}>
      <CollapsibleTrigger className="flex w-full flex-col items-stretch gap-1 p-4 text-left hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring md:px-6">
        <span className="flex items-center gap-2">
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden />
          {icon}
          <span className="min-w-0 font-black">{title}</span>
          {status && <span className="ml-auto shrink-0">{status}</span>}
        </span>
        {!open && summary && <span className="pl-6 font-extralight text-muted-foreground">{summary}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("flex flex-col gap-4 border-t p-4 md:p-6", contentClassName)}>{children}</CollapsibleContent>
    </Collapsible>
  );
}
