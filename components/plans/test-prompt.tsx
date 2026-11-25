"use client";

import { openCard } from "@/components/plans/collapsible-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";

/** Shown while a period's 5k test is due and no time has been entered. */
export function TestPrompt() {
  const { testsDue, screen, setScreen } = useApp();
  if (!testsDue.length) return null;
  const n = testsDue[0] + 1;
  const enter = () => {
    setScreen("paces");
    openCard("pace-tests"); setTimeout(() => document.getElementById("pace-tests")?.scrollIntoView({ behavior: "smooth" }), 300);
  };
  return (
    <Alert className="border-signal bg-signal-soft">
      <AlertTitle className="font-black">5k test due</AlertTitle>
      <AlertDescription className="gap-3">
        <p>Period {n} is finishing: run the 5k test in your plan and enter your time on Profile to update your paces for Period {n + 1}.</p>
        {screen !== "paces" && <Button size="lg" onClick={enter}>Enter time</Button>}
      </AlertDescription>
    </Alert>
  );
}
