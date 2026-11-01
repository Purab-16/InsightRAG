import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InsightRAG",
  description: "Chat with research papers, get insights and citations you can check.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <div className="flex min-h-screen">
              <Suspense fallback={<aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:block" />}>
                <AppSidebar />
              </Suspense>
              <div className="flex min-w-0 flex-1 flex-col">
                <Suspense fallback={<header className="h-16 border-b border-border bg-surface" />}>
                  <AppHeader />
                </Suspense>
                <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-8 print:p-0">{children}</main>
                <footer className="border-t border-border px-4 py-6 text-center text-[13px] text-muted-foreground print:hidden">
                  Papers you upload are private to you. Don&apos;t upload unpublished drafts: free-tier AI providers
                  may use inputs to improve their models.
                </footer>
              </div>
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
