import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCountryIndex, useWorld } from './hooks/queries';
import { useLayout, usePrefersReducedMotion } from './hooks/useMediaQuery';
import { useSelection } from './hooks/useSelection';
import { AboutDialog } from './components/layout/AboutDialog';
import { Header } from './components/layout/Header';
import { BottomSheet, Drawer, SHEET_PEEK_PX } from './components/layout/Overlays';
import { MapStage, type ViewMode } from './components/map/MapStage';
import { CountryPanel } from './components/panel/CountryPanel';
import { WelcomePanel } from './components/panel/WelcomePanel';
import { Sidebar, type Scope } from './components/sidebar/Sidebar';

const VIEW_KEY = 'atlas:view';
const TABLET_PANEL_PX = 392;

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'globe' ? 'globe' : 'map';
  } catch {
    return 'map';
  }
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export default function App() {
  const countries = useCountryIndex();
  const world = useWorld();
  const [selectedId, select] = useSelection();
  const layout = useLayout();
  const reducedMotion = usePrefersReducedMotion();

  const [view, setView] = useState<ViewMode>(readView);
  const [region, setRegion] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [locateNonce, setLocateNonce] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const index = countries.data;
  const selected = selectedId ? index?.byId.get(selectedId) : undefined;

  const changeView = useCallback((next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Preference simply isn't remembered.
    }
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      select(id);
      setDrawerOpen(false);
      setSheetExpanded(false);
    },
    [select],
  );
  const handleClose = useCallback(() => select(null), [select]);
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
      } else if (e.key === 'Escape' && !aboutOpen) {
        if (drawerOpen) setDrawerOpen(false);
        else if (selectedId && !isTyping(e.target)) select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layout, view, changeView, drawerOpen, selectedId, select, aboutOpen]);

  const activeIds = useMemo(
    () => (region && index ? new Set(index.sorted.filter((c) => c.region === region).map((c) => c.cca3)) : null),
    [region, index],
  );

  const insets = useMemo(() => {
    if (!selectedId || layout === 'desktop') return { right: 0, bottom: 0 };
    if (layout === 'tablet') return { right: TABLET_PANEL_PX + 16, bottom: 0 };
    return { right: 0, bottom: SHEET_PEEK_PX };
  }, [selectedId, layout]);

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
    />
  );

  const panel = (sheetHeader?: React.ReactNode) =>
    selectedId ? (
      <CountryPanel
        id={selectedId}
        index={index}
        onClose={handleClose}
        onSelect={handleSelect}
        onLocate={handleLocate}
        sheetHeader={sheetHeader}
      />
    ) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header
        provider={index?.provider}
        showSearchButton={layout !== 'desktop'}
        onOpenSearch={() => setDrawerOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1">
        {layout === 'desktop' ? (
          <aside className="w-[300px] shrink-0 border-r border-white/[0.06] bg-ink-900 2xl:w-[320px]">{sidebar}</aside>
        ) : (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {sidebar}
          </Drawer>
        )}

        <main className="relative min-w-0 flex-1">
          <MapStage
            locateKey={locateNonce}
            world={world.data}
            worldError={world.isError}
            onRetry={() => world.refetch()}
            index={index}
            selectedId={selectedId}
            activeIds={activeIds}
            insets={insets}
            view={view}
            reducedMotion={reducedMotion}
            onViewChange={changeView}
            onSelect={handleSelect}
            showLegend={layout === 'desktop'}
          />
        </main>

        {layout === 'desktop' && (
          <aside className="w-[400px] shrink-0 border-l border-white/[0.06] 2xl:w-[440px]">
            {selectedId ? panel() : <WelcomePanel index={index} onSelect={handleSelect} />}
          </aside>
        )}

        {layout === 'tablet' && selectedId && (
          <aside
            className="absolute bottom-3 right-3 top-3 z-20 animate-rise overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60"
            style={{ width: TABLET_PANEL_PX }}
          >
            {panel()}
          </aside>
        )}
      </div>

      {layout === 'mobile' && selectedId && (
        <BottomSheet expanded={sheetExpanded} onExpandedChange={setSheetExpanded} onDismiss={handleClose}>
          {(handle) => panel(handle)}
        </BottomSheet>
      )}

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} index={index} />
    </div>
  );
}
