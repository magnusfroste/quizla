import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analytics.service";

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsService.getAnalytics,
  });
}
