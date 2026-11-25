import type { Metadata, Viewport } from "next";
import "./globals.css";
import { body, display, mono } from "./fonts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/components/app-provider";

export const metadata: Metadata = {
  title: "Haji Training Block",
  description: "Sub-threshold run paces and a 12-week Norwegian Singles plan, plus a 12-week HYROX station program that targets your weak stations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e1116" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AppProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </AppProvider>
      </body>
    </html>
  );
}
