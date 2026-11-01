"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Class strategy; dark by default, the header toggle switches to light.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
