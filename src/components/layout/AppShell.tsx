import { Outlet, useMatch } from 'react-router-dom';
import { DirectionProvider } from '@/components/foundations/direction/direction';
import { BottomNav, SideNav } from './Navigation';
import { OnlineIndicator } from './OnlineIndicator';
import { InstallPrompt } from './InstallPrompt';
import { UpdatePrompt } from './UpdatePrompt';
import { cn } from '../../lib/cn';

export function AppShell() {
  const matchNewReport = useMatch('/reports/new/:id');
  const matchEditReport = useMatch('/reports/:id/edit');
  const matchNewTemplate = useMatch('/templates/new');
  const matchEditTemplate = useMatch('/templates/:id');
  const editing = Boolean(
    matchNewReport || matchEditReport || matchNewTemplate || matchEditTemplate,
  );

  return (
    <DirectionProvider locale="en-US">
      <div className="min-h-dvh">
        <SideNav />
        <div
          className={cn(
            'lg:ps-60',
            editing ? '' : 'pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0',
          )}
        >
          <UpdatePrompt />
          <OnlineIndicator />
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
        {!editing && <BottomNav />}
        <InstallPrompt />
      </div>
    </DirectionProvider>
  );
}
