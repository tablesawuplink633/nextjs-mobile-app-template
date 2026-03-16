'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useCallback, useEffect, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Home,
  PenLine,
  Timer,
  BarChart3,
  Dumbbell,
  Target,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { startViewTransition } from '@/lib/view-transition';
import { HapticsProvider, useHaptics } from '@/components/shared/HapticsProvider';
import { useTabNavigation, type TabRoute } from '@/components/shared/TabContext';

const NAV_ITEMS: { tab: TabRoute; label: string; icon: typeof Home }[] = [
  { tab: '/', label: 'Today', icon: Home },
  { tab: '/log', label: 'Log', icon: PenLine },
  { tab: '/timer', label: 'Timer', icon: Timer },
  { tab: '/history', label: 'History', icon: BarChart3 },
  { tab: '/templates', label: 'Templates', icon: Dumbbell },
  { tab: '/goals', label: 'Goals', icon: Target },
];


export function AppShell({ children }: { children: React.ReactNode }) {
  const tabCtx = useTabNavigation();
  const router = useRouter();

  // Tabbed mode: inside TabProvider (main app)
  // Standalone mode: export/settings pages (no tab context)
  const isTabbed = !!tabCtx;

  /** Navigate back with View Transition animation (reverse pop) */
  const handleBackClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.documentElement.classList.add('vt-back');
    startViewTransition(() => {
      router.push('/');
    });
  };

  return (
    <HapticsProvider>
    {/* 
      IMPORTANT: The nav MUST be inside this h-dvh flex-col container as a 
      normal flex child (shrink-0), NOT position:fixed. On iOS standalone PWAs,
      position:fixed bottom-0 does not reach the actual screen bottom — it 
      floats above the home indicator. Normal flex flow inside h-dvh pushes 
      the nav to the true screen bottom. See notes/ios-pwa-layout.md.
    */}
    <div className={cn(
      'flex flex-col bg-background overflow-hidden',
      isTabbed ? 'h-dvh' : 'min-h-dvh',
    )}>
      {isTabbed ? (
        <div
          ref={tabCtx.containerRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            alignItems: 'flex-start',
          }}
        >
          {children}
        </div>
      ) : (
        <>
          <header
            className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="mx-auto flex h-12 max-w-2xl items-center px-2">
              <Link
                href="/"
                onClick={handleBackClick}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 min-h-[44px] text-sm font-medium text-primary transition-colors hover:bg-accent/60 active:bg-accent"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Back</span>
              </Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-2">
            <div className="animate-fade-in-up">
              {children}
            </div>
          </main>
        </>
      )}
      {/* Nav is a flex child (shrink-0) INSIDE the h-dvh container — not fixed */}
      <BottomNav
        navItems={NAV_ITEMS}
        isTabbed={isTabbed}
        tabCtx={tabCtx}
        onBackClick={handleBackClick}
      />
    </div>
    </HapticsProvider>
  );
}

/* ─────────────────────────────────────────────
   Bottom nav with drag-to-navigate gesture
   and fluid sliding indicator
   
   CRITICAL: Uses shrink-0 in normal flex flow,
   NOT position:fixed. See notes/ios-pwa-layout.md
   ───────────────────────────────────────────── */

interface BottomNavProps {
  navItems: typeof NAV_ITEMS;
  isTabbed: boolean;
  tabCtx: ReturnType<typeof useTabNavigation>;
  onBackClick: (e: MouseEvent<HTMLAnchorElement>) => void;
}

function BottomNav({ navItems, isTabbed, tabCtx, onBackClick }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const lastTabIndex = useRef(-1);
  const haptics = useHaptics();
  const prevActiveTab = useRef(tabCtx?.activeTab);

  const progress = tabCtx?.scrollProgress ?? 0;
  const tabCount = navItems.length;

  // Fire haptic on every tab change (swipe, drag, or tap)
  useEffect(() => {
    if (!isTabbed || !tabCtx) return;
    if (tabCtx.activeTab !== prevActiveTab.current) {
      prevActiveTab.current = tabCtx.activeTab;
      haptics.trigger('selection');
    }
  }, [tabCtx?.activeTab, isTabbed, haptics]);

  /** Find which tab button the pointer is over */
  const getTabIndexAtX = useCallback((clientX: number): number => {
    const nav = navRef.current;
    if (!nav) return -1;
    const buttons = nav.querySelectorAll<HTMLElement>('[data-tab-index]');
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return i;
      }
    }
    return -1;
  }, []);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastTabIndex.current = getTabIndexAtX(e.clientX);
    navRef.current?.setPointerCapture(e.pointerId);
  }, [getTabIndexAtX]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging.current || !isTabbed || !tabCtx) return;

    const idx = getTabIndexAtX(e.clientX);
    if (idx !== -1 && idx !== lastTabIndex.current) {
      lastTabIndex.current = idx;
      tabCtx.scrollToTab(navItems[idx].tab);
    }
  }, [isTabbed, tabCtx, navItems, getTabIndexAtX]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    lastTabIndex.current = -1;
  }, []);

  return (
    <nav
      ref={navRef}
      className="shrink-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl touch-none"
      role="navigation"
      aria-label="Main navigation"
      style={{
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) / 2)',
      }}
      onPointerDown={isTabbed ? handlePointerDown : undefined}
      onPointerMove={isTabbed ? handlePointerMove : undefined}
      onPointerUp={isTabbed ? handlePointerUp : undefined}
      onPointerCancel={isTabbed ? handlePointerUp : undefined}
    >
      <div className="relative mx-auto flex max-w-2xl items-center justify-around px-1 pt-1.5 pb-1.5">
        {/* Sliding indicator -- positioned via scrollProgress */}
        {isTabbed && (
          <span
            className="absolute -top-px h-0.5 rounded-full bg-primary"
            style={{
              width: `${100 / tabCount}%`,
              left: `${(progress / tabCount) * 100}%`,
              transition: dragging.current ? 'none' : undefined,
            }}
            aria-hidden
          />
        )}

        {navItems.map(({ tab, label, icon: Icon }, index) => {
          // Compute how "active" this tab is: 1 when exactly on it, 0 when >= 1 tab away
          const distance = isTabbed ? Math.abs(progress - index) : Infinity;
          const activity = isTabbed ? Math.max(0, 1 - distance) : 0;
          const isNearest = isTabbed ? tabCtx?.activeTab === tab : false;

          // Interpolate opacity: muted-foreground (~0.5) to primary (1.0)
          const opacity = 0.5 + activity * 0.5;
          // Interpolate scale: 1.0 to 1.1
          const scale = 1 + activity * 0.1;
          // Interpolate stroke width: 2 to 2.5
          const stroke = 2 + activity * 0.5;

          if (isTabbed) {
            return (
              <button
                key={tab}
                type="button"
                data-tab-index={index}
                onClick={() => tabCtx?.scrollToTab(tab)}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-0.5 rounded-xl min-w-[44px] min-h-[44px] px-2 py-1.5 text-[11px] select-none',
                  activity > 0.5 ? 'text-primary' : 'text-muted-foreground',
                  activity > 0.5 && 'font-medium',
                )}
                style={{ opacity }}
                aria-current={isNearest ? 'page' : undefined}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ transform: `scale(${scale})` }}
                  strokeWidth={stroke}
                />
                <span className="leading-none">{label}</span>
              </button>
            );
          }

          // Standalone mode: use links back to main app with back transition
          return (
            <Link
              key={tab}
              href={tab === '/' ? '/' : `/#${tab.slice(1)}`}
              data-tab-index={index}
              onClick={onBackClick}
              className="group relative flex flex-col items-center justify-center gap-0.5 rounded-xl min-w-[44px] min-h-[44px] px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground select-none"
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
