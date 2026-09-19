import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aeroxpress",
  description: "Burn DJI flight telemetry into your drone footage.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster richColors theme="light" />
        </TooltipProvider>
      </body>
    </html>
  );
}
