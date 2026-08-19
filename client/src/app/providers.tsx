import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { AccentPaletteSync } from "@/app/AccentPaletteSync";
import { REGISTERED_THEMES, THEME_STORAGE_KEY } from "@/lib/themeIds";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="vibrant"
        disableTransitionOnChange
        storageKey={THEME_STORAGE_KEY}
        enableSystem={false}
        themes={[...REGISTERED_THEMES]}
      >
        <AccentPaletteSync />
        {children}
        <Toaster richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
