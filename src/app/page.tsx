'use client';

import { useEffect, Suspense } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { TabProvider } from '@/components/shared/TabContext';
import { TabPane } from '@/components/shared/TabPane';
import { TodayScreen } from '@/components/today/TodayScreen';
import { LogScreen } from '@/components/log/LogScreen';
import { TimerScreen } from '@/components/timer/TimerScreen';
import { HistoryScreen } from '@/components/history/HistoryScreen';
import { TemplatesScreen } from '@/components/templates/TemplatesScreen';
import { GoalsScreen } from '@/components/goals/GoalsScreen';
import { registerServiceWorker } from '@/lib/sw-register';

export default function HomePage() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <TabProvider>
      <AppShell>
        <TabPane>
          <TodayScreen />
        </TabPane>
        <TabPane>
          <Suspense>
            <LogScreen />
          </Suspense>
        </TabPane>
        <TabPane>
          <TimerScreen />
        </TabPane>
        <TabPane>
          <HistoryScreen />
        </TabPane>
        <TabPane>
          <TemplatesScreen />
        </TabPane>
        <TabPane>
          <GoalsScreen />
        </TabPane>
      </AppShell>
    </TabProvider>
  );
}
