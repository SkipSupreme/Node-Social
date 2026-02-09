import { useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GovernanceScreen } from '../../src/screens/GovernanceScreen';

type TabId = 'moderation' | 'council' | 'trust' | 'appeals' | 'blocked';

const VALID_TABS: TabId[] = ['moderation', 'council', 'trust', 'appeals', 'blocked'];

export default function GovernanceRoute() {
  const params = useLocalSearchParams<{
    tab?: string;
    nodeId?: string;
    nodeName?: string;
    userId?: string;
  }>();
  const router = useRouter();

  const initialTab = useMemo(
    () => VALID_TABS.includes(params.tab as TabId) ? (params.tab as TabId) : undefined,
    [params.tab]
  );

  const handleBack = useCallback(() => router.back(), [router]);
  const handleUserClick = useCallback(
    (userId: string) => router.push(`/user/${userId}` as any),
    [router]
  );

  return (
    <GovernanceScreen
      onBack={handleBack}
      initialTab={initialTab}
      nodeId={params.nodeId}
      nodeName={params.nodeName}
      userId={params.userId}
      onUserClick={handleUserClick}
    />
  );
}
