import { useQuery } from '@tanstack/react-query';
import { getNodeCouncil, getCouncilEligibility, listAppeals, getVouchesGiven, getVouchesReceived } from '../lib/api';
import type { AppealStatus } from '../lib/api';

export function useNodeCouncil(nodeId: string | undefined) {
  return useQuery({
    queryKey: ['council', nodeId],
    queryFn: () => getNodeCouncil(nodeId!),
    enabled: !!nodeId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCouncilEligibility(nodeId: string | undefined) {
  return useQuery({
    queryKey: ['councilEligibility', nodeId],
    queryFn: () => getCouncilEligibility(nodeId!),
    enabled: !!nodeId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAppeals(params?: { status?: AppealStatus; targetType?: 'post' | 'comment' | 'mod_action' }) {
  return useQuery({
    queryKey: ['appeals', params],
    queryFn: () => listAppeals(params),
    staleTime: 60_000,
  });
}

export function useVouchesGiven(enabled = true) {
  return useQuery({
    queryKey: ['vouchesGiven'],
    queryFn: getVouchesGiven,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useVouchesReceived(enabled = true) {
  return useQuery({
    queryKey: ['vouchesReceived'],
    queryFn: getVouchesReceived,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
