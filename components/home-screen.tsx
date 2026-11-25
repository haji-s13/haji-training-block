import { SignInCard } from "@/components/auth/sign-in-card";

const FEATURES: [string, string][] = [
  ["Profile", "Your PB, paces and season: dates, races and time off"],
  ["Run plan", "Your dates, in 12-week periods of three 4-week blocks, 5% a week at most"],
  ["HYROX", "Station blocks with extra work on your weak ones"],
  ["One season", "Pick start and end, add races and time off; each race gets a taper"],
  ["Watch", "Send runs to COROS, everything to intervals.icu"],
  ["Profile", "Sign in to open your plans on any device"],
];

/** First screen: a graphite banner that carries on from the header, then what's inside. */
export function HomeScreen() {
  return (
    <main>
      <section className="bg-hero text-hero-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-[max(16px,env(safe-area-inset-left))] pt-8 pb-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-16 md:px-8 md:pt-16 md:pb-24">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-meta uppercase text-signal">Haji Training Block</p>
            <h1 className="font-display text-[2.5rem] leading-[48px] font-black tracking-tight md:text-[4rem] md:leading-[72px]">
              Run At Threshold.<br />
              <span className="font-extralight">Race The Stations.</span>
            </h1>
            <p className="max-w-[56ch] text-hero-muted">
              Sub-threshold paces from your 5k or 10k PB, a Norwegian Singles run plan and a HYROX station program built around your race dates, with extra work where you lose time.
            </p>
            <div className="grid gap-px overflow-hidden rounded-lg border border-hero-muted/25 bg-hero-muted/25 sm:grid-cols-2">
              <div className="bg-hero p-4">
                <p className="text-meta uppercase text-hero-muted">Run · Tue, week 1</p>
                <p className="num mt-2 text-[1.25rem] leading-8 font-black">5 × 1 km @ 4:12–4:18</p>
                <p className="num text-hero-muted">60s jog · ~44 min</p>
              </div>
              <div className="bg-hero p-4">
                <p className="text-meta uppercase text-hero-muted">HYROX · Tue, week 6</p>
                <p className="mt-2 text-[1.25rem] leading-8 font-black">Lunge Specificity</p>
                <p className="text-hero-muted"><span className="text-signal">Weak station</span> · 4 rounds, ramping load</p>
              </div>
            </div>
          </div>
          <div className="min-w-0 text-foreground md:pt-8">
            <SignInCard />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-[max(16px,env(safe-area-inset-left))] py-12 md:px-8 md:py-16">
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FEATURES.map(([k, v], i) => (
            <li key={k} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 border-t pt-4">
              <span className="num text-meta text-signal">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-col">
                <span className="font-black">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
