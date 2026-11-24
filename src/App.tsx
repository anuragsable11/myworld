import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dices } from 'lucide-react';
import { isSovereign, useCountryIndex, useWorld } from './hooks/queries';
import { useLayout, useMediaQuery, usePrefersReducedMotion } from './hooks/useMediaQuery';
import { useSafeArea } from './hooks/useSafeArea';
import { useSelection } from './hooks/useSelection';
import { discover, MILESTONES } from './lib/discoveries';
import { returnFlight, sameFlight, type FlightPlan } from './lib/flight';
import { haptics } from './lib/haptics';
import { sounds } from './lib/sounds';
import { FlightCard, type FlightCardHandle } from './components/flight/FlightCard';
import { AboutDialog } from './components/layout/AboutDialog';
import { BottomNav } from './components/layout/BottomNav';
import { DiscoveryToast, type Discovery } from './components/layout/DiscoveryToast';
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

// The quiz loads on demand (and is fetched ahead once the page is idle, so it opens at once).
const loadQuiz = () => import('./components/game/FlagQuiz');
const FlagQuiz = lazy(loadQuiz);
// Compare loads the same way, once it's first opened.
const loadCompare = () => import('./components/compare/CompareDialog');
const CompareDialog = lazy(loadCompare);
// And so does the flight planner.
const loadFlightPicker = () => import('./components/flight/FlightPicker');
const FlightPicker = lazy(loadFlightPicker);

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

/** The big floating cards are frosted glass, as on iOS. */
const card = 'glass-panel overflow-hidden rounded-[30px]';

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
  const [quizOpen, setQuizOpen] = useState(false);
  /** The quiz stays mounted after its first opening, so it reopens instantly. */
  const [quizMounted, setQuizMounted] = useState(false);
  /** Compare: open, and the country it was opened from. It also stays mounted once opened. */
  const [compare, setCompare] = useState<{ open: boolean; first: string | null }>({ open: false, first: null });
  const [compareMounted, setCompareMounted] = useState(false);
  /** Flight Path: its planner (open, and the country it was opened from), which also stays mounted… */
  const [planner, setPlanner] = useState<{ open: boolean; from: string | null }>({ open: false, from: null });
  const [plannerMounted, setPlannerMounted] = useState(false);
  /** …and the flight being flown on the globe, with whether its plane has landed. */
  const [flight, setFlight] = useState<FlightPlan | null>(null);
  const [flightLanded, setFlightLanded] = useState(false);
  /** The view to go back to after a flight that had to leave it for the globe. */
  const viewBeforeFlight = useRef<ViewMode | null>(null);
  const flightCard = useRef<FlightCardHandle>(null);
  const [flightCardHeight, setFlightCardHeight] = useState(0);
  const flightCardObserver = useRef<ResizeObserver | null>(null);
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

  const changeView = useCallback(
    (next: ViewMode) => {
      if (next !== view) sounds.morph();
      // Flights are flown on the globe, so choosing the map ends one; and from here the view is
      // theirs, not one to go back from.
      viewBeforeFlight.current = null;
      if (next !== 'globe') {
        setFlight(null);
        setFlightLanded(false);
      }
      setView(next);
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        // Preference simply isn't remembered.
      }
    },
    [view],
  );

  const toggleNight = useCallback(() => {
    const next = !showNight;
    sounds.toggle(next);
    haptics.toggle();
    setShowNight(next);
    try {
      localStorage.setItem(NIGHT_KEY, next ? 'on' : 'off');
    } catch {
      // Preference simply isn't remembered.
    }
  }, [showNight]);

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
  /** Ends the flight being shown, returning to the map if the flight had left it for the globe. */
  const clearFlight = useCallback(() => {
    setFlight(null);
    setFlightLanded(false);
    if (viewBeforeFlight.current) setView(viewBeforeFlight.current);
    viewBeforeFlight.current = null;
  }, []);
  const handleSelect = useCallback(
    (id: string) => {
      stopSpin();
      setSpinFor(null);
      clearFlight();
      haptics.select();
      sounds.select();
      show(id);
    },
    [show, stopSpin, clearFlight],
  );
  const handleClose = useCallback(() => {
    stopSpin();
    sounds.close();
    select(null);
  }, [select, stopSpin]);
  /** Flies to a random sovereign state, the globe taking an extra turn on the way. */
  const handleSurprise = useCallback(() => {
    const pool = index?.sorted.filter((c) => isSovereign(c) && c.cca3 !== selectedId) ?? [];
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)].cca3;
    // A flight makes way, and the shuffle lands on the view the flight had borrowed the globe from.
    const landingView = viewBeforeFlight.current ?? view;
    clearFlight();
    setSpinFor(pick);
    show(pick);
    window.clearTimeout(spinTimer.current);
    if (reducedMotion) return setSpinning(false);
    setSpinning(true);
    spinTimer.current = window.setTimeout(() => setSpinning(false), SHUFFLE_MS[landingView]);
  }, [index, selectedId, show, reducedMotion, view, clearFlight]);
  useEffect(() => () => window.clearTimeout(spinTimer.current), []);

  /** Tapping the view that's already showing recentres it, as tapping an app's current tab does. */
  const handleNavView = useCallback(
    (next: ViewMode) => {
      if (next === view) {
        sounds.zoom('out');
        setResetNonce((n) => n + 1);
      } else changeView(next);
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
  const openQuiz = useCallback(() => {
    if (!index) return;
    stopSpin();
    setDrawerOpen(false);
    setQuizMounted(true);
    setQuizOpen(true);
  }, [index, stopSpin]);
  const closeQuiz = useCallback(() => setQuizOpen(false), []);
  /** From the quiz's results: see a country in the atlas. */
  const showFromQuiz = useCallback(
    (id: string) => {
      setQuizOpen(false);
      handleSelect(id);
    },
    [handleSelect],
  );
  const openCompare = useCallback((id: string) => {
    setCompareMounted(true);
    setCompare({ open: true, first: id });
  }, []);
  const closeCompare = useCallback(() => setCompare((c) => ({ ...c, open: false })), []);
  /** From Compare: see one of the two countries in the atlas. */
  const showFromCompare = useCallback(
    (id: string) => {
      setCompare((c) => ({ ...c, open: false }));
      handleSelect(id);
    },
    [handleSelect],
  );
  /** Opens the flight planner, from a country (which the flight then leaves) or from the map. */
  const openPlanner = useCallback(
    (from?: string) => {
      if (!index) return;
      stopSpin();
      setDrawerOpen(false);
      setPlannerMounted(true);
      setPlanner({ open: true, from: from ?? null });
    },
    [index, stopSpin],
  );
  const closePlanner = useCallback(() => setPlanner((p) => ({ ...p, open: false })), []);
  /** Take-off: the profile makes way, the globe takes the stage and the plane flies. */
  const fly = useCallback(
    (plan: FlightPlan) => {
      stopSpin();
      setSpinFor(null);
      setPlanner((p) => ({ ...p, open: false }));
      setDrawerOpen(false);
      setSheetExpanded(false);
      if (view !== 'globe') {
        // Borrowed for the flight, so not remembered as their choice.
        viewBeforeFlight.current = view;
        setView('globe');
      }
      select(null);
      haptics.select();
      sounds.boarding();
      setFlightLanded(false);
      setFlight(plan);
    },
    [select, stopSpin, view],
  );
  const closeFlight = useCallback(() => {
    sounds.close();
    clearFlight();
  }, [clearFlight]);
  const flyAgain = useCallback(() => flight && fly(sameFlight(flight)), [flight, fly]);
  const flyBack = useCallback(() => flight && fly(returnFlight(flight)), [flight, fly]);
  // The globe reports the plane's progress frame by frame, straight to the card.
  const handleFlightProgress = useCallback((progress: number) => flightCard.current?.progress(progress), []);
  const handleFlightLand = useCallback(() => setFlightLanded(true), []);
  // The phone's flight card floats above the tab bar; the globe makes room for however tall it is.
  const flightCardBox = useCallback((box: HTMLElement | null) => {
    flightCardObserver.current?.disconnect();
    if (!box) return setFlightCardHeight(0);
    flightCardObserver.current = new ResizeObserver(() => setFlightCardHeight(box.offsetHeight));
    flightCardObserver.current.observe(box);
  }, []);
  // A country that arrives by any other road (the back button, a link) ends the flight too.
  useEffect(() => {
    if (selectedId) clearFlight();
  }, [selectedId, clearFlight]);

  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    const fetchAhead = () => {
      void loadQuiz();
      void loadCompare();
      void loadFlightPicker();
    };
    const timer = window.setTimeout(() => (idle ? idle(fetchAhead, { timeout: 5000 }) : fetchAhead()), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLocate = useCallback(() => {
    setSheetExpanded(false);
    setLocateNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    document.title = flight
      ? `${flight.from.place} to ${flight.to.place} — World Atlas`
      : selected
        ? `${selected.name} — World Atlas`
        : 'World Atlas — Countries Explorer';
  }, [selected, flight]);

  // The first visit to each country is a small celebration, and milestones a bigger one. The visit
  // waits in a ref, so the celebration survives React running this effect twice in development.
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const pendingDiscovery = useRef<{ id: string; count: number } | null>(null);
  useEffect(() => {
    if (!shownId || !index?.byId.has(shownId)) return;
    const visit = discover(shownId);
    if (visit.first) pendingDiscovery.current = { id: shownId, count: visit.count };
    const pending = pendingDiscovery.current;
    if (pending?.id !== shownId) return;
    // After the select sound and the pin landing, so the moments don't pile up.
    const timer = window.setTimeout(() => {
      pendingDiscovery.current = null;
      const total = index.sorted.length;
      const milestone = MILESTONES.includes(pending.count) || pending.count >= total;
      if (milestone) {
        sounds.milestone();
        haptics.milestone();
      } else {
        sounds.discover();
        haptics.discover();
      }
      setDiscovery({ key: Date.now(), name: index.byId.get(pending.id)?.name ?? pending.id, count: pending.count, total, milestone });
    }, 1300);
    return () => window.clearTimeout(timer);
  }, [shownId, index]);

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

  // Keyboard shortcuts: "/" or Ctrl/⌘+K search, "g" toggles the globe, "f" plans a flight, Esc closes things.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A dialog (the quiz, About) has the keyboard to itself.
      if (document.querySelector('dialog[open]')) return;
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
      } else if (e.key.toLowerCase() === 'q' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        openQuiz();
      } else if (e.key.toLowerCase() === 'f' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // From the country that's open, if one is.
        openPlanner(selectedId ?? undefined);
      } else if (e.key === 'Escape' && !e.defaultPrevented) {
        // One thing at a time, like back on Android. Handled here, so the close watchers that back
        // also reaches don't close a second thing for the same key press.
        if (drawerOpen) setDrawerOpen(false);
        else if (layout === 'mobile' && sheetExpanded && selectedId) setSheetExpanded(false);
        else if (selectedId && !isTyping(e.target)) handleClose();
        else if (flight && !isTyping(e.target)) closeFlight();
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, view, changeView, toggleNight, drawerOpen, sheetExpanded, selectedId, handleClose, openQuiz, openPlanner, flight, closeFlight]);

  /** The map is out of sight behind an open sheet, menu or dialog, so it can stop animating. */
  const covered = (layout === 'mobile' && !!shownId && sheetExpanded) || drawerOpen || aboutOpen || quizOpen || compare.open || planner.open;

  const activeIds = useMemo(
    () => (region && index ? new Set(index.sorted.filter((c) => c.region === region).map((c) => c.cca3)) : null),
    [region, index],
  );

  // The map fills the screen; these are the parts covered by floating cards.
  const insets = useMemo<Insets>(() => {
    // Cards carry a 6px hard shadow, so leave room for it too.
    if (layout === 'desktop') return { top: 0, bottom: 0, left: sidebarPx + GAP + 6, right: panelPx + GAP + 10 };
    if (layout === 'tablet') return { top: topBarBottom, bottom: 0, left: 0, right: shownId || spinning || flight ? TABLET_PANEL_PX + GAP : 0 };
    return { top: topBarBottom, bottom: navHeight + (shownId ? peek : flight ? flightCardHeight + 14 : 0), left: 0, right: 0 };
  }, [layout, shownId, spinning, flight, flightCardHeight, sidebarPx, panelPx, topBarBottom, navHeight, peek]);

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
        <div className="flex items-center justify-between gap-2 pb-1">
          <Brand large />
          <div className="-mr-1.5 flex">
            <SoundButton />
            <InfoButton onClick={() => setAboutOpen(true)} />
          </div>
        </div>
      }
    />
  );

  const panel = (id: string | null, sheetHeader?: ReactNode) =>
    id ? (
      <CountryPanel
        id={id}
        index={index}
        onClose={handleClose}
        onSelect={handleSelect}
        onLocate={handleLocate}
        onCompare={openCompare}
        onFly={openPlanner}
        sheetHeader={sheetHeader}
      />
    ) : null;

  /** The flight being flown: the whole story beside the map, or a short card above a phone's tab bar. */
  const flightInfo = (compact: boolean) =>
    flight ? (
      <FlightCard
        ref={flightCard}
        plan={flight}
        index={index}
        landed={flightLanded}
        compact={compact}
        onAgain={flyAgain}
        onReturn={flyBack}
        onNew={() => openPlanner()}
        onExplore={handleSelect}
        onClose={closeFlight}
      />
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
          onPlay={openQuiz}
          onFly={openPlanner}
          flight={flight}
          flightLanded={flightLanded}
          onFlightProgress={handleFlightProgress}
          onFlightLand={handleFlightLand}
          spinFor={spinFor}
          showLegend={layout === 'desktop'}
        />
      </main>

      {layout === 'desktop' ? (
        <>
          <aside
            className={`${card} absolute bottom-4 left-3 top-3 z-20 animate-rise`}
            style={{ width: sidebarPx }}
          >
            {sidebar}
          </aside>
          <aside
            className={`${card} absolute bottom-4 right-4 top-3 z-20 animate-rise [animation-delay:90ms]`}
            style={{ width: panelPx }}
          >
            {flight ? (
              flightInfo(false)
            ) : spinning ? (
              <SpinningCard />
            ) : shownId ? (
              panel(shownId)
            ) : (
              <WelcomePanel index={index} onSelect={handleSelect} onSurprise={handleSurprise} onPlay={openQuiz} onFly={openPlanner} />
            )}
          </aside>
        </>
      ) : (
        <>
          <TopBar
            onOpenSearch={layout === 'tablet' ? () => setDrawerOpen(true) : undefined}
            onOpenAbout={() => setAboutOpen(true)}
            // Phones moved day/night from the tab bar up here, to make room for the quiz.
            night={showNight}
            onNight={layout === 'mobile' ? toggleNight : undefined}
          />
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {sidebar}
          </Drawer>
        </>
      )}

      {layout === 'tablet' && flight ? (
        // As tall as its story, and no taller than the screen.
        <aside
          className={`${card} absolute right-4 z-20 animate-rise`}
          style={{ width: TABLET_PANEL_PX, top: topBarBottom + GAP, maxHeight: `calc(100% - ${topBarBottom + GAP + 16}px)` }}
        >
          {flightInfo(false)}
        </aside>
      ) : (
        layout === 'tablet' &&
        (shownId || spinning) && (
          <aside
            className={`${card} absolute bottom-4 right-4 z-20 animate-rise`}
            style={{ width: TABLET_PANEL_PX, top: topBarBottom + GAP }}
          >
            {spinning ? <SpinningCard /> : panel(shownId)}
          </aside>
        )
      )}

      {layout === 'mobile' && (
        <>
          {/* As on iOS 26, the sheet runs down behind the floating tab bar, so it peeks that much higher. */}
          <BottomSheet
            open={!!shownId}
            expanded={sheetExpanded}
            onExpandedChange={setSheetExpanded}
            onDismiss={handleClose}
            peek={peek + navHeight}
            bottom={0}
          >
            {(handle) => panel(sheetId, handle)}
          </BottomSheet>
          {flight && (
            <aside
              ref={flightCardBox}
              className={`${card} fixed inset-x-3 z-30 animate-rise [--glass-alpha:0.68]`}
              style={{ bottom: navHeight + 8 }}
            >
              {flightInfo(true)}
            </aside>
          )}
          <BottomNav
            ref={navRef}
            view={view}
            onView={handleNavView}
            onShuffle={handleSurprise}
            shuffling={spinning}
            canShuffle={!!index}
            onSearch={() => setDrawerOpen(true)}
            onPlay={openQuiz}
            onFly={openPlanner}
            flying={!!flight}
            canPlay={!!index}
          />
        </>
      )}

      {/* Desktop offers installing from the welcome card instead. */}
      {(layout === 'tablet' || (layout === 'mobile' && !shownId && !spinning && !flight)) && (
        <div className="absolute z-10" style={{ left: insets.left + 12, bottom: insets.bottom + 16 }}>
          <InstallPill />
        </div>
      )}

      {layout !== 'desktop' && (
        <GestureHint ready={!!world.data && !selectedId && !spinning && !drawerOpen && !quizOpen && !flight && !planner.open} view={view} top={topBarBottom + 12} />
      )}
      <UpdateToast top={layout === 'desktop' ? 16 : topBarBottom + 10} />
      {/* Centred over the map; on desktop below the globe/map switch */}
      <DiscoveryToast
        discovery={discovery}
        style={layout === 'desktop' ? { top: 68, left: insets.left, right: insets.right } : { top: topBarBottom + 12, left: 0, right: 0 }}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} index={index} />
      {quizMounted && index && (
        <Suspense fallback={null}>
          <FlagQuiz open={quizOpen} countries={index.sorted} onClose={closeQuiz} onShowCountry={showFromQuiz} />
        </Suspense>
      )}
      {compareMounted && index && (
        <Suspense fallback={null}>
          <CompareDialog open={compare.open} first={compare.first} index={index} onClose={closeCompare} onShowCountry={showFromCompare} />
        </Suspense>
      )}
      {plannerMounted && index && (
        <Suspense fallback={null}>
          <FlightPicker open={planner.open} from={planner.from} index={index} world={world.data} onClose={closePlanner} onFly={fly} />
        </Suspense>
      )}
    </div>
  );
}

/** Stands in for the profile while a shuffle is in flight. */
function SpinningCard() {
  return (
    <div className="grid h-full place-items-center p-8 text-center" role="status">
      <div className="flex flex-col items-center">
        <span aria-hidden className="grid size-16 place-items-center rounded-[18px] bg-tint text-white shadow-[0_6px_18px_rgb(0_122_255/0.35)]">
          <Dices className="size-9 animate-dice-roll" strokeWidth={1.8} />
        </span>
        <p className="ios-title mt-5 text-[22px]">Spinning the globe…</p>
        <p className="mt-1 text-[15px] text-secondary">Where will it land?</p>
      </div>
    </div>
  );
}
