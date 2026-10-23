import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "PublikEye",
  description: "Official public records and statistical observations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-white text-slate-900 antialiased">
        <TooltipProvider>
          <main className="mx-auto max-w-5xl p-6">{children}</main>
        </TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
