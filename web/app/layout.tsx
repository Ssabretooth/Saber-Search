import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { SidebarNav } from "@/components/sidebar-nav";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "PublikEye",
  description: "Official public records and statistical observations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-[#FAFAF7] text-slate-900 antialiased">
        <AuthProvider>
          <TooltipProvider>
            <div className="flex min-h-screen">
              <SidebarNav />
              <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 pb-20 md:pb-6">
                {children}
              </main>
            </div>
          </TooltipProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
