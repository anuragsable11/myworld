import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isSovereign, useCountryIndex, useWorld } from './hooks/queries';
import { useLayout, useMediaQuery, usePrefersReducedMotion } from './hooks/useMediaQuery';
import { useSafeArea } from './hooks/useSafeArea';
import { useSelection } from './hooks/useSelection';
import { haptics } from './lib/haptics';
import { sounds } from './lib/sounds';
import { AboutDialog } from './components/layout/AboutDialog';
import { BottomNav } from './components/layout/BottomNav';
import { Brand, InfoButton, SoundButton, TopBar } from './components/layout/Header';
import { InstallPill } from './components/layout/Install';
import { UpdateToast } from './components/layout/UpdateToast';
import { GestureHint } from './components/layout/GestureHint';
import { BottomSheet, Drawer, SHEET_PEEK_PX } from './components/layout/Overlays';
import { MapStage, type ViewMode } from './components/map/MapStage';
import { SHUFFLE_MS, type Insets } from './components/map/types';
import { CountryPanel } from './components/panel/CountryPanel';
import { WelcomePanel } from './components/panel/WelcomePanel';
import { Sidebar, type Scope } from './components/sidebar/Sidebar';

const VIEW_KEY = 'atlas:view';
const NIGHT_KEY = 'atlas:night';
const GAP = 12;
/** Height of the floating top bar, below its top margin (or the notch). */
const TOP_BAR_PX = 56;
const TABLET_PANEL_PX = 392;

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'globe';
  } catch {
    return 'globe';
  }
}

function readNight(): boolean {
  try {
    return localStorage.getItem(NIGHT_KEY) !== 'off';
  } catch {
    return true;
  }
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const card = 'toon-lg overflow-hidden rounded-[30px]';

export default function App() {
  const countries = useCountryIndex();
  const world = useWorld();
  const [selectedId, select] = useSelection();
  const layout = useLayout();
  const wide = useMediaQuery('(min-width: 1360px)');
  const reducedMotion = usePrefersReducedMotion();

  const [view, setView] = useState<ViewMode>(readView);
  const [showNight, setShowNight] = useState(readNight);
  const [region, setRegion] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [locateNonce, setLocateNonce] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [spinFor, setSpinFor] = useState<string | null>(null);
  /** A shuffle is in flight: the profile waits until it lands, so the globe has the screen to itself. */
  const [spinning, setSpinning] = useState(false);
  const spinTimer = useRef(0);
  const [navHeight, setNavHeight] = useState(0);
  const navObserver = useRef<ResizeObserver | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const safeArea = useSafeArea();
  const shortScreen = useMediaQuery('(max-height: 720px)');

  const index = countries.data;
  const selected = selectedId ? index?.byId.get(selectedId) : undefined;
  // The profile follows the selection at a lower priority, so it renders in the gaps between the
  // map's animation frames instead of freezing them.
  const shownId = useDeferredValue(spinning ? null : selectedId);
  const lastShownId = useRef(shownId);
  if (shownId) lastShownId.current = shownId;
  const sheetId = shownId ?? lastShownId.current;
  const topBarBottom = Math.max(GAP, safeArea.top) + TOP_BAR_PX;
  const peek = shortScreen ? 250 : SHEET_PEEK_PX;
  const sidebarPx = wide ? 320 : 292;
  const panelPx = wide ? 420 : 380;

  const changeView = useCallback((next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Preference simply isn't remembered.
    }
  }, []);

  const toggleNight = useCallback(() => {
    setShowNight((on) => {
      try {
        localStorage.setItem(NIGHT_KEY, on ? 'off' : 'on');
      } catch {
        // Preference simply isn't remembered.
      }
      return !on;
    });
  }, []);

  const show = useCallback(
    (id: string) => {
      select(id);
      setDrawerOpen(false);
      setSheetExpanded(false);
    },
    [select],
  );
  const stopSpin = useCallback(() => {
    window.clearTimeout(spinTimer.current);
    setSpinning(false);
  }, []);
  const handleSelect = useCallback(
    (id: string) => {
      stopSpin();
      setSpinFor(null);
      haptics.select();
      sounds.select();
      show(id);
    },
    [show, stopSpin],
  );
  const handleClose = useCallback(() => {
    stopSpin();
    select(null);
  }, [select, stopSpin]);
  /** Flies to a random sovereign state, the globe taking an extra turn on the way. */
  const handleSurprise = useCallback(() => {
    const pool = index?.sorted.filter((c) => isSovereign(c) && c.cca3 !== selectedId) ?? [];
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)].cca3;
    setSpinFor(pick);
    show(pick);
    window.clearTimeout(spinTimer.current);
    if (reducedMotion) return setSpinning(false);
    setSpinning(true);
    spinTimer.current = window.setTimeout(() => setSpinning(false), SHUFFLE_MS[view]);
  }, [index, selectedId, show, reducedMotion, view]);
  useEffect(() => () => window.clearTimeout(spinTimer.current), []);

  /** Tapping the view that's already showing recentres it, as tapping an app's current tab does. */
  const handleNavView = useCallback(
    (next: ViewMode) => {
      if (next === view) setResetNonce((n) => n + 1);
      else changeView(next);
    },
    [view, changeView],
  );
  // The tab bar's height includes the home indicator area, so measure it.
  const navRef = useCallback((nav: HTMLElement | null) => {
    navObserver.current?.disconnect();
    if (!nav) return setNavHeight(0);
    navObserver.current = new ResizeObserver(() => setNavHeight(nav.offsetHeight));
    navObserver.current.observe(nav);
  }, []);
  const handleLocate = useCallback(() => {
    setSheetExpanded(false);
    setLocateNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    document.title = selected ? `${selected.name} — World Atlas` : 'World Atlas — Countries Explorer';
  }, [selected]);

  useEffect(() => {
    if (layout === 'desktop') setDrawerOpen(false);
  }, [layout]);

  // Going back or forward through the countries seen shows the map again, as an app would.
  useEffect(() => {
    const onPop = () => {
      setDrawerOpen(false);
      setSheetExpanded(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Keyboard shortcuts: "/" or Ctrl/⌘+K search, "g" toggles the globe, Esc closes things.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === '/' && !isTyping(e.target)) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        if (layout === 'desktop') searchRef.current?.focus();
        else {
          // The drawer's contents are inert until it opens.
          setDrawerOpen(true);
          requestAnimationFrame(() => searchRef.current?.focus());
        }
      } else if (e.key.toLowerCase() === 'g' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        changeView(view === 'map' ? 'globe' : 'map');
      } else if (e.key.toLowerCase() === 'n' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        toggleNight();
      } else if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) {
        // One thing at a time, like back on Android. Handled here, so the close watchers that back
        // also reaches don't close a second thing for the same key press.
        if (drawerOpen) setDrawerOpen(false);
        else if (layout === 'mobile' && sheetExpanded && selectedId) setSheetExpanded(false);
        else if (selectedId && !isTyping(e.target)) handleClose();
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, view, changeView, toggleNight, drawerOpen, sheetExpanded, selectedId, handleClose]);

  /** The map is out of sight behind an open sheet, menu or dialog, so it can stop animating. */
  const covered = (layout === 'mobile' && !!shownId && sheetExpanded) || drawerOpen || aboutOpen;

  const activeIds = useMemo(
    () => (region && index ? new Set(index.sorted.filter((c) => c.region === region).map((c) => c.cca3)) : null),
    [region, index],
  );

  // The map fills the screen; these are the parts covered by floating cards.
  const insets = useMemo<Insets>(() => {
    // Cards carry a 6px hard shadow, so leave room for it too.
    if (layout === 'desktop') return { top: 0, bottom: 0, left: sidebarPx + GAP + 6, right: panelPx + GAP + 10 };
    if (layout === 'tablet') return { top: topBarBottom, bottom: 0, left: 0, right: shownId || spinning ? TABLET_PANEL_PX + GAP : 0 };
    return { top: topBarBottom, bottom: navHeight + (shownId ? peek : 0), left: 0, right: 0 };
  }, [layout, shownId, spinning, sidebarPx, panelPx, topBarBottom, navHeight, peek]);

  const sidebar = (
    <Sidebar
      index={index}
      loading={countries.isLoading}
      error={countries.isError}
      onRetry={() => countries.refetch()}
      selectedId={selectedId}
      onSelect={handleSelect}
      region={region}
      onRegionChange={setRegion}
      scope={scope}
      onScopeChange={setScope}
      searchRef={searchRef}
      autoFocus={drawerOpen}
      header={
        <div className="flex items-center justify-between pb-1">
          <Brand />
          <div className="flex gap-2">
            <SoundButton />
            <InfoButton onClick={() => setAboutOpen(true)} />
          </div>
        </div>
      }
    />
  );

  const panel = (id: string | null, sheetHeader?: ReactNode) =>
    id ? (
      <CountryPanel id={id} index={index} onClose={handleClose} onSelect={handleSelect} onLocate={handleLocate} sheetHeader={sheetHeader} />
    ) : null;

  return (
    <div className="relative h-dvh overflow-hidden">
      <main className="absolute inset-0">
        <MapStage
          paused={covered}
          locateKey={locateNonce}
          resetKey={resetNonce}
          world={world.data}
          worldError={world.isError}
          onRetry={() => world.refetch()}
          index={index}
          selectedId={selectedId}
          activeIds={activeIds}
          insets={insets}
          view={view}
          reducedMotion={reducedMotion}
          compact={layout === 'mobile'}
          showNight={showNight}
          onToggleNight={toggleNight}
          onViewChange={changeView}
          onSelect={handleSelect}
          onSurprise={handleSurprise}
          spinFor={spinFor}
          showLegend={layout === 'desktop'}
        />
      </main>

      {layout === 'desktop' ? (
        <>
          <aside
            className={`${card} absolute bottom-4 left-3 top-3 z-20 animate-rise bg-white`}
            style={{ width: sidebarPx }}
          >
            {sidebar}
          </aside>
          <aside
            className={`${card} absolute bottom-4 right-4 top-3 z-20 animate-rise bg-paper [animation-delay:90ms]`}
            style={{ width: panelPx }}
          >
            {spinning ? (
              <SpinningCard />
            ) : shownId ? (
              panel(shownId)
            ) : (
              <WelcomePanel index={index} onSelect={handleSelect} onSurprise={handleSurprise} />
            )}
          </aside>
        </>
      ) : (
        <>
          <TopBar onOpenSearch={layout === 'tablet' ? () => setDrawerOpen(true) : undefined} onOpenAbout={() => setAboutOpen(true)} />
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {sidebar}
          </Drawer>
        </>
      )}

      {layout === 'tablet' && (shownId || spinning) && (
        <aside
          className={`${card} absolute bottom-4 right-4 z-20 animate-rise bg-paper`}
          style={{ width: TABLET_PANEL_PX, top: topBarBottom + GAP }}
        >
          {spinning ? <SpinningCard /> : panel(shownId)}
        </aside>
      )}

      {layout === 'mobile' && (
        <>
          <BottomSheet
            open={!!shownId}
            expanded={sheetExpanded}
            onExpandedChange={setSheetExpanded}
            onDismiss={handleClose}
            peek={peek}
            bottom={navHeight}
          >
            {(handle) => panel(sheetId, handle)}
          </BottomSheet>
          <BottomNav
            ref={navRef}
            view={view}
            onView={handleNavView}
            onShuffle={handleSurprise}
            shuffling={spinning}
            canShuffle={!!index}
            onSearch={() => setDrawerOpen(true)}
            night={showNight}
            onNight={toggleNight}
          />
        </>
      )}

      {/* Desktop offers installing from the welcome card instead. */}
      {(layout === 'tablet' || (layout === 'mobile' && !shownId && !spinning)) && (
        <div className="absolute z-10" style={{ left: insets.left + 12, bottom: insets.bottom + 16 }}>
          <InstallPill />
        </div>
      )}

      {layout !== 'desktop' && (
        <GestureHint ready={!!world.data && !selectedId && !spinning && !drawerOpen} view={view} top={topBarBottom + 12} />
      )}
      <UpdateToast top={layout === 'desktop' ? 16 : topBarBottom + 10} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} index={index} />
    </div>
  );
}

/** Stands in for the profile while a shuffle is in flight. */
function SpinningCard() {
  return (
    <div className="grid h-full place-items-center p-8 text-center" role="status">
      <div>
        <div aria-hidden className="inline-block animate-dice-roll text-[64px] leading-none">
          🎲
        </div>
        <p className="toon-title mt-5 text-[24px]">Spinning the globe…</p>
        <p className="mt-1.5 text-[14px] font-semibold text-slate-500">Where will it land? 🌍</p>
      </div>
    </div>
  );
}
