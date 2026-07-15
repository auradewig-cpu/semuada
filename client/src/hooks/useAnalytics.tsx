import { useQuery } from '@tanstack/react-query';

export type Period = '1d' | '7d' | '30d' | 'all';

export interface AnalyticsData {
  totalProducts: number;
  totalClicks: number;
  topProducts: { product_id: string; product_name: string; click_count: number }[];
}

export function useAnalytics(period: Period = 'all') {
  return useQuery<AnalyticsData>({
    queryKey: ['analytics', period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?period=${period}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
}
