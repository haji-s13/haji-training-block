"use client";

import { CalendarRange, Dumbbell, LayoutDashboard, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp, type Screen } from "@/components/app-provider";
import { SiteHeader } from "@/components/site-header";
import { HomeScreen } from "@/components/home-screen";
import { NewPasswordCard } from "@/components/auth/new-password-card";
import { PacesScreen } from "@/components/paces/paces-screen";
import { BuilderScreen } from "@/components/builder/builder-screen";
import { LiftingScreen } from "@/components/lifting/lifting-screen";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

const NAV: { value: Screen; label: string; Icon: typeof UserRound }[] = [
  { value: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { value: "builder", label: "Run", Icon: CalendarRange },
  { value: "hyrox", label: "Lifting", Icon: Dumbbell },
  { value: "paces", label: "Profile", Icon: UserRound },
];

export default function Page() {
  const { ready, entry, screen, setScreen, recovering } = useApp();
  if (!ready) return <div className="min-h-dvh bg-background" />;
  if (recovering) return (<><SiteHeader showAccount={false} /><NewPasswordCard /></>);
  if (!entry) return (<><SiteHeader showAccount={false} /><HomeScreen /></>);

  return (
    <>
      <SiteHeader />
      <Tabs value={screen} onValueChange={(v) => setScreen(v as Screen)} className="gap-0">
        {/* Bottom bar on phones, top tabs from md up. */}
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[max(8px,env(safe-area-inset-bottom))] md:static md:border-t-0 md:border-b md:bg-background md:pb-0">
          <TabsList className="mx-auto grid h-16 w-full max-w-6xl grid-cols-4 rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-16 md:flex md:h-12 md:justify-start md:gap-2 md:px-8 md:group-data-[orientation=horizontal]/tabs:h-12">
            {NAV.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value}
                className="h-full flex-col gap-1 rounded-none border-0 text-meta uppercase data-[state=active]:bg-transparent data-[state=active]:text-signal md:flex-row md:gap-2 md:border-b-2 md:border-transparent md:px-4 md:text-body md:normal-case md:tracking-normal md:data-[state=active]:border-signal">
                <Icon className="size-5 md:size-4" aria-hidden />{label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <main className="mx-auto w-full max-w-6xl px-[max(16px,env(safe-area-inset-left))] pt-8 pb-[calc(144px+env(safe-area-inset-bottom))] md:px-8 md:pb-16">
          <TabsContent value="dashboard"><DashboardScreen /></TabsContent>
          <TabsContent value="builder"><BuilderScreen /></TabsContent>
          <TabsContent value="hyrox"><LiftingScreen /></TabsContent>
          <TabsContent value="paces"><PacesScreen /></TabsContent>
        </main>
      </Tabs>
    </>
  );
}
