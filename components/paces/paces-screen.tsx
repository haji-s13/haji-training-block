"use client";

import { SaveStatus } from "@/components/plans/save-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/components/app-provider";
import { PbForm } from "./pb-form";
import { PaceTestsCard } from "./pace-tests-card";
import { BodyCard } from "./body-card";
import { TestPrompt } from "@/components/plans/test-prompt";
import { testForPeriod } from "@/lib/settings";
import { RaceTable } from "./race-table";
import { PaceTable } from "./pace-table";
import { SeasonCard } from "@/components/plans/season-card";
import { CorosCard } from "@/components/connections/coros-card";
import { IntervalsCard } from "@/components/connections/intervals-card";
import { HealthConnectCard } from "@/components/connections/health-connect-card";

/** Profile: your PB, your season (shared by both plans), and the paces they're built from. */
export function PacesScreen() {
  const { model, currentModel, currentPeriod, settings, user } = useApp();
  const shown = currentModel ?? model;
  const test = currentPeriod > 0 ? testForPeriod(settings, currentPeriod) : null;
  const fromTest = !!test && !!shown && shown !== model;
  const source = fromTest ? `From your 5k test after period ${test.period + 1}` : "From your PB";
  const name = (user?.user_metadata?.display_name as string | undefined) || user?.email;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-[2rem] leading-10 font-black md:text-display">Profile</h1>
        <p className="max-w-[65ch] text-muted-foreground">
          {name ? `${name}: your` : "Your"} PB, your season and your connections. The run plan and the HYROX plan are both built from what you set here.
        </p>
        <SaveStatus />
      </section>

      <TestPrompt />

      <Card className="gap-4 py-6">
        <CardHeader className="px-4 md:px-6"><CardTitle className="font-black">Paces</CardTitle></CardHeader>
        <CardContent className="px-4 md:px-6"><PbForm /></CardContent>
      </Card>

      <BodyCard />

      <PaceTestsCard />

      <SeasonCard />

      <section className="grid items-end gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-16">
        <div>
          <p className="text-meta uppercase text-muted-foreground">Your VDOT</p>
          <p className="num text-[6rem] leading-[6rem] font-extralight text-signal md:text-hero">
            {shown ? shown.vdot.toFixed(1) : "–"}
          </p>
        </div>
        <div className="min-w-0 pb-2">
          <h2 className="font-display text-[2rem] leading-10 font-black">Predicted Paces</h2>
          <p className="max-w-[65ch] text-muted-foreground">
            {source}, using Jack Daniels&apos; VDOT formula. Every pace is a range: the fast end is the most you should push.
          </p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="gap-2 py-6">
          <CardHeader className="px-4 md:px-6"><CardTitle className="text-meta uppercase">Race Predictions</CardTitle></CardHeader>
          <CardContent className="px-4 md:px-6"><RaceTable /></CardContent>
        </Card>
        <Card className="gap-2 py-6">
          <CardHeader className="px-4 md:px-6"><CardTitle className="text-meta uppercase">Training Paces</CardTitle></CardHeader>
          <CardContent className="px-4 md:px-6">
            <PaceTable />
            <p className="mt-4 max-w-[65ch] font-extralight text-muted-foreground">
              Reps should feel controlled, and you should finish every session feeling you could do one more. Heart rate and lactate matter more than the watch.
            </p>
          </CardContent>
        </Card>
      </div>

      <section id="connections" className="flex scroll-mt-8 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[2rem] leading-10 font-black">Connections</h2>
          <p className="max-w-[65ch] text-muted-foreground">Send workouts to your watch. Connect COROS directly, or use intervals.icu for COROS, Garmin and others. Connect Google Health Connect to see your weight and sleep.</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <CorosCard />
          <IntervalsCard />
          <HealthConnectCard />
        </div>
      </section>
    </div>
  );
}
