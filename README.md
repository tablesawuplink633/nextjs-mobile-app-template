# Next.js Native App Template

A boilerplate for building native-feeling apps with Next.js 16. Ships as a workout tracker; swap in your own domain.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · oRPC · TanStack Query · SQLite (better-sqlite3) · PWA

---

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000
```

On iPhone: open in Safari, tap Share > Add to Home Screen. The app runs fullscreen with a native bottom tab bar.

---

## How the native layout works

The entire UI is a single-page app (`src/app/page.tsx`) that uses **horizontal scroll-snap** for tab navigation. This gives you swipe-between-tabs behavior identical to native iOS/Android apps, with no client-side router for tab changes.

### The shell structure

```
<div class="h-dvh flex-col overflow-hidden">     ← full viewport height
  <div class="flex-1 min-h-0 flex snap-x          ← horizontal scroll container
       snap-mandatory overflow-x-auto"
       style="align-items: flex-start">
    <TabPane style="height: {measured}px" />       ← each pane is exactly
    <TabPane style="height: {measured}px" />          the container height
    <TabPane style="height: {measured}px" />
    ...
  </div>
  <BottomNav class="shrink-0" />                   ← IN the flex column, not fixed
</div>
```

Key files:
- `src/components/shared/AppShell.tsx` — the outer shell and bottom nav
- `src/components/shared/TabContext.tsx` — scroll tracking, URL sync, pane height measurement
- `src/components/shared/TabPane.tsx` — individual tab wrapper

### Why this layout exists (iOS PWA gotchas)

Every decision here was made to work around iOS standalone PWA behavior. If you change the layout, read this section first.

#### Bottom nav: flex flow, not `position: fixed`

**Do NOT use `position: fixed; bottom: 0` for the bottom nav.** On iOS standalone PWAs, `fixed bottom-0` places the element at the viewport bottom (793px on an iPhone 15), which is visually above the home indicator. There is always a system-drawn gap below it.

The fix: the nav is a normal **flex child** (`shrink-0`) inside the `h-dvh flex-col` container. iOS resolves `h-dvh` in a flex column to include the home indicator region, so flex layout pushes the nav to the true screen bottom.

```tsx
// AppShell.tsx — the nav is INSIDE the h-dvh div
<div className="h-dvh flex flex-col overflow-hidden">
  <div className="flex-1 min-h-0 ...">  {/* scroll container */}
    {children}
  </div>
  <BottomNav className="shrink-0" />     {/* normal flow, not fixed */}
</div>
```

If you move the nav outside this container or add `fixed`/`absolute` positioning, it will float above the screen bottom on iOS.

#### Pane heights: JS-measured, not CSS

Flexbox `align-items: stretch` (the default) causes all tab panes to expand to the height of the tallest pane's content. A tab with 200px of content would have thousands of pixels of dead scrollable space because it inherits the height of the longest tab.

CSS solutions (`h-full`, `100dvh`, `-webkit-fill-available`, Grid) all fail on iOS Safari.

The fix is two parts:

1. **`align-items: flex-start`** on the scroll container — prevents cross-axis stretching
2. **ResizeObserver** in `TabContext` measures the container's `clientHeight` and exposes it as `paneHeight`. Each `TabPane` sets `height: ${paneHeight}px` as an inline style. An explicit pixel value cannot be misinterpreted.

```tsx
// TabContext.tsx — measures the scroll container
useEffect(() => {
  const ro = new ResizeObserver(([entry]) => {
    setPaneHeight(entry.contentRect.height);
  });
  ro.observe(container);
  return () => ro.disconnect();
}, []);

// TabPane.tsx — applies the measured height
<div style={{ height: h ? `${h}px` : '100%' }}>
```

#### Body background: killing the bottom strip

iOS draws a system-controlled strip below the app viewport. Its color comes from `background_color` in `manifest.json`, the `theme-color` meta tag, and the body's computed `background-color`.

Two things make this strip invisible:

1. **Hex fallback colors** on `html` and `body` — iOS can't parse oklch, so the CSS custom properties alone won't work. Always set a hex `background-color` alongside them.

2. **Body stretch** — `min-height: 100dvh` and `padding-bottom: env(safe-area-inset-bottom)` on body force it to fill the full viewport and paint its background into the home indicator region.

```css
/* globals.css */
body {
  background-color: #f5f0e8;        /* hex fallback iOS can read */
  min-height: 100dvh;               /* stretch to full viewport */
  padding-bottom: env(safe-area-inset-bottom);  /* paint into safe area */
}
```

#### Theme sync: no flash on load

The layout includes an inline `<script>` in `<head>` that reads `localStorage.theme` and applies the dark class synchronously, before React hydrates. This prevents the white-flash-then-dark-mode problem.

```tsx
// layout.tsx
<script dangerouslySetInnerHTML={{
  __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);var h=document.documentElement;h.classList.toggle('dark',d);h.style.colorScheme=d?'dark':'light';h.style.backgroundColor=d?'#1a1714':'#f5f0e8'}catch(e){}})()`
}} />
```

#### `env(safe-area-inset-bottom)` is 0 in standalone mode

Because the iOS standalone viewport already excludes the safe area, `env(safe-area-inset-bottom)` returns 0. The nav still includes `padding-bottom: calc(env(safe-area-inset-bottom, 0px) / 2)` for devices/modes where it is nonzero, but don't rely on it for layout.

---

## Service worker

`public/sw.js` handles offline support:

- **Navigation requests**: network-first, falls back to cache
- **Static assets**: stale-while-revalidate (serves cached instantly, updates in background)
- **API calls** (`/rpc/`): always go to network, never cached

**After layout changes, bump `CACHE_NAME`** in `sw.js` (e.g. `app-v2` → `app-v3`). iOS can hold onto the old service worker even after closing and reopening the app.

---

## Tab navigation

Tab switching works via `container.scrollTo({ behavior: 'smooth' })`. The `TabContext` tracks scroll position with `requestAnimationFrame` during scroll and derives the active tab from `Math.round(scrollLeft / clientWidth)`.

URLs update via `history.replaceState` (no full page navigation) after scroll settles. Deep links work through URL hash (`/#log`, `/#timer`, etc.) — hash-to-tab mapping runs on mount.

The bottom nav supports **drag-to-navigate**: pointer-capture on the nav bar lets you slide your finger across tabs to switch between them.

---

## Standalone pages (Settings, Export)

Settings and Export are separate Next.js routes (`/settings`, `/export`) that render inside `AppShell` without a `TabProvider`. In this mode:

- The shell shows a "Back" header with a View Transitions API animation (iOS-like push/pop)
- The bottom nav renders as links back to the main app
- The outer div uses `min-h-dvh` instead of `h-dvh` so content can scroll naturally

---

## Architecture overview

```
src/
├── app/
│   ├── layout.tsx          # fonts, metadata, viewport, theme sync script
│   ├── page.tsx            # single-page app shell (all tabs)
│   ├── providers.tsx       # QueryClientProvider
│   ├── globals.css         # tailwind, oklch theme, animations, iOS fixes
│   ├── rpc/[[...rest]]/    # oRPC catch-all API route
│   ├── settings/           # standalone settings page
│   └── export/             # standalone export page
├── components/
│   ├── shared/             # AppShell, TabContext, TabPane, HapticsProvider, etc.
│   ├── ui/                 # shadcn/ui primitives (button, card, badge, etc.)
│   ├── today/              # Today dashboard
│   ├── log/                # Log forms (workout, rest day, note)
│   ├── timer/              # Workout timer
│   ├── history/            # Weekly review / stats
│   ├── templates/          # Workout template management
│   ├── goals/              # Goal tracking
│   ├── settings/           # Settings screen
│   └── export/             # Data export/import
├── hooks/                  # useProfile, useEvents, useSchedule, useTemplates, etc.
└── lib/
    ├── orpc.ts             # oRPC client (browser-side)
    ├── types.ts            # all TypeScript types
    ├── defaults.ts         # default profile, schedule, templates
    ├── analytics.ts        # streak calc, weekly review, insights
    ├── view-transition.ts  # View Transitions API wrapper
    ├── sw-register.ts      # service worker registration
    └── server/
        ├── db.ts           # SQLite setup + migrations
        ├── dao.ts          # data access (CRUD for all tables)
        └── router.ts       # oRPC router (all API procedures)
```

---

## Data layer

- **Database**: SQLite via `better-sqlite3`, stored at `data/app.db`. WAL mode. Auto-migrates on first access.
- **API**: oRPC with Zod validation. All calls go through `/rpc/` — a single Next.js catch-all route.
- **Client state**: TanStack Query. Hooks in `src/hooks/` wrap oRPC calls with optimistic updates and cache invalidation.
- **No auth**: single-user, device-local. The profile table has one row (id = `'default'`).

---

## Adapting to your own app

1. **Types** — Replace the types in `src/lib/types.ts` with your domain
2. **Schema** — Update the `migrate()` function in `src/lib/server/db.ts`
3. **DAO** — Rewrite `src/lib/server/dao.ts` for your tables
4. **Router** — Update procedures in `src/lib/server/router.ts`
5. **Hooks** — Rewrite hooks in `src/hooks/` to match your new API
6. **Screens** — Replace the screen components in `src/components/`
7. **Tabs** — Change `TAB_ROUTES` in `TabContext.tsx` and `NAV_ITEMS` in `AppShell.tsx`
8. **Defaults** — Update `src/lib/defaults.ts` with your initial data
9. **PWA** — Update `public/manifest.json` with your app name and icons
10. **Theme** — Edit the oklch values in `globals.css` (keep the hex fallbacks in sync)

The shared infrastructure (`AppShell`, `TabContext`, `TabPane`, `HapticsProvider`, all UI components) should not need changes.

---

## Things that will break if you change them

| What | Why |
|---|---|
| Moving `<BottomNav>` outside the `h-dvh` div | Nav floats above screen bottom on iOS PWA |
| Adding `position: fixed` to the nav | Same — doesn't reach screen bottom on iOS |
| Removing `align-items: flex-start` from scroll container | All panes stretch to tallest pane height |
| Removing the ResizeObserver pane height measurement | Panes won't have correct height on iOS |
| Removing hex `background-color` fallbacks | iOS renders black strip below app |
| Removing `min-height: 100dvh` from body | System-drawn strip visible at bottom |
| Forgetting to bump `CACHE_NAME` in sw.js after changes | iOS serves stale cached version |
| Using CSS viewport units for pane heights | iOS Safari ignores them in flex children |
