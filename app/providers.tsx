"use client";

import { HydrationBoundary, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CategoryProvider } from "@/context/CategoryContext";
import { TrackingScripts } from "@/components/TrackingScripts";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";

// HydrationBoundary must sit ABOVE CategoryProvider, not below/inside it --
// CategoryProvider's useCategories() call needs the categoryHierarchy query
// already hydrated by the time IT renders. Since it's mounted globally here
// (every page needs it, not just the homepage), the prefetch that feeds
// dehydratedState lives in app/layout.tsx, a server component, and gets
// threaded down as a prop -- Providers itself is a client component and
// can't query the DB directly.
export function Providers({ children, dehydratedState }: { children: React.ReactNode; dehydratedState?: DehydratedState }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={dehydratedState}>
            <ThemeProvider storageKey="theme">
              <CategoryProvider>
                <TrackingScripts />
                {children}
                <WhatsAppButton />
                <Toaster />
              </CategoryProvider>
            </ThemeProvider>
          </HydrationBoundary>
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
