import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { usePhotoCredit, usePhotos, useSymbols } from '../../../hooks/queries';
import type { PhotoGroup } from '../../../lib/sources/photos';
import type { SymbolKind } from '../../../lib/sources/symbols';
import { Skeleton, SubHeading } from '../../ui/primitives';
import type { CountryDetails } from '../details';
import { Section } from '../Section';

const GROUPS: { id: PhotoGroup; label: string; emoji: string }[] = [
  { id: 'places', label: 'Famous places', emoji: '🏛️' },
  { id: 'history', label: 'History', emoji: '📜' },
  { id: 'nature', label: 'Nature', emoji: '🏞️' },
  { id: 'wildlife', label: 'Animals & plants', emoji: '🐾' },
  { id: 'food', label: 'Food', emoji: '🍛' },
  { id: 'culture', label: 'Culture', emoji: '🎭' },
  { id: 'people', label: 'People & life', emoji: '👥' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
];

const SYMBOLS: { kind: SymbolKind; label: string; emoji: string }[] = [
  { kind: 'animal', label: 'Animal', emoji: '🦁' },
  { kind: 'bird', label: 'Bird', emoji: '🐦' },
  { kind: 'flower', label: 'Flower', emoji: '🌸' },
  { kind: 'tree', label: 'Tree', emoji: '🌳' },
  { kind: 'dish', label: 'Dish', emoji: '🍲' },
];

/** Anything the photo viewer can show: an article photo or a national symbol. */
interface Shot {
  key: string;
  thumb: string;
  large: string;
  title: string;
  /** Commons file name, for the credit line. */
  file?: string;
  /** What it is, e.g. "🦁 National animal", shown above the title in the viewer. */
  label?: string;
  /** The short form of the label, for the cards. */
  tag?: string;
  article?: string;
}

const wikipediaUrl = (page: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}`;

export function Photos({ country, wikipedia }: CountryDetails) {
  const symbols = useSymbols();
  const photos = usePhotos(wikipedia.data?.title);
  const [chosen, setChosen] = useState<PhotoGroup>();
  const [viewing, setViewing] = useState<{ shots: Shot[]; index: number }>();

  const own = symbols.data?.[country.cca3];
  const symbolShots: Shot[] = SYMBOLS.flatMap(({ kind, label, emoji }) => {
    const s = own?.[kind];
    if (!s?.image) return [];
    return [
      {
        key: kind,
        thumb: s.image,
        large: s.image,
        title: s.name,
        file: s.file,
        label: `${emoji} National ${label.toLowerCase()}`,
        tag: `${emoji} ${label}`,
        article: wikipediaUrl(s.page),
      },
    ];
  });

  const all = photos.data ?? [];
  const groups = GROUPS.filter((g) => all.some((p) => p.group === g.id));
  const group = groups.find((g) => g.id === chosen) ?? groups[0];
  const shots: Shot[] = all
    .filter((p) => p.group === group?.id)
    .map((p) => ({ key: p.file, thumb: p.thumb, large: p.large, title: p.caption, file: p.file }));

  const loadingPhotos = wikipedia.loading || photos.isLoading;
  const nothing = !loadingPhotos && !symbols.isLoading && !shots.length && !symbolShots.length;

  return (
    <Section
      tone="indigo"
      order={1}
      id="photos"
      title="Picture tour"
      emoji="📸"
      source={<>Wikipedia articles and lists of national symbols; pictures from Wikimedia Commons (tap one for its photographer and licence)</>}
    >
      {symbolShots.length > 0 && (
        <>
          <SubHeading>National symbols</SubHeading>
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-3.5">
            {symbolShots.map((s, i) => (
              <button key={s.key} type="button" onClick={() => setViewing({ shots: symbolShots, index: i })} className="group min-w-0 text-left">
                <div
                  className="toon-sm rounded-2xl bg-white p-1.5 transition-transform duration-300 group-hover:scale-105"
                >
                  <Picture src={s.thumb} className="aspect-square rounded-xl" />
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase leading-tight tracking-wide text-ink/50">{s.tag}</div>
                <div className="line-clamp-2 text-[13px] font-bold leading-tight text-ink">{s.title}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <SubHeading aside={shots.length ? 'Tap a photo to zoom' : undefined}>Photos</SubHeading>
      {groups.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 pt-0.5">
          {groups.map((g) => {
            const on = g.id === group?.id;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => setChosen(g.id)}
                className={clsx(
                  'shrink-0 rounded-full border-2 border-ink px-3 py-1 text-[12.5px] font-bold text-ink transition-all duration-200',
                  on ? 'bg-sun shadow-[0_2px_6px_rgba(30,27,75,0.16)]' : 'bg-white hover:bg-indigo-50',
                )}
              >
                {g.emoji} {g.label}
                <span className="ml-1 text-ink/45">{all.filter((p) => p.group === g.id).length}</span>
              </button>
            );
          })}
        </div>
      )}

      {loadingPhotos ? (
        <div className="mt-2 grid grid-cols-2 gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[4/3.6] w-full rounded-lg" />
          ))}
        </div>
      ) : shots.length ? (
        <div key={group?.id} className="mt-2 grid grid-cols-2 gap-x-3.5 gap-y-4">
          {shots.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setViewing({ shots, index: i })}
              className="relative block w-full animate-pop rounded-lg border-2 border-ink bg-white p-1.5 pb-2 text-left shadow-[0_3px_10px_rgba(30,27,75,0.16)] transition-transform duration-300 hover:z-10 hover:scale-[1.04]"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              {/* A strip of tape holding the photo on the page */}
              <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rounded-sm bg-amber-200/85" />
              <Picture src={s.thumb} className="aspect-[4/3] rounded-md" />
              {s.title ? (
                <span className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug text-slate-600">{s.title}</span>
              ) : (
                <span aria-hidden className="block h-4" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] font-semibold italic text-slate-400">
          {nothing ? `No pictures of ${country.name} yet. 📷` : 'No photos found in this country’s article. 📷'}
        </p>
      )}

      {viewing && (
        <PhotoViewer
          shots={viewing.shots}
          index={viewing.index}
          untitled={`A photo from ${country.name}`}
          onIndex={(index) => setViewing({ ...viewing, index })}
          onClose={() => setViewing(undefined)}
        />
      )}
    </Section>
  );
}

/** A lazily loaded picture that turns into a camera placeholder if it can't load (for example offline). */
function Picture({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span aria-hidden className={clsx('grid w-full place-items-center bg-indigo-50 text-[28px]', className)}>
        📷
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      // CORS mode lets the service worker keep a real copy for offline use.
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      className={clsx('block w-full bg-indigo-50 object-cover', className)}
    />
  );
}

function PhotoViewer({
  shots,
  index,
  untitled,
  onIndex,
  onClose,
}: {
  shots: Shot[];
  index: number;
  /** Title for photos without a caption. */
  untitled: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const swipeFrom = useRef<number | null>(null);
  const shot = shots[index];
  const title = shot.title || untitled;
  const credit = usePhotoCredit(shot.file);
  const go = (step: number) => onIndex((index + step + shots.length) % shots.length);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      className="toon-lg m-auto w-[min(94vw,720px)] animate-pop rounded-[28px] bg-paper p-0 text-ink backdrop:bg-indigo-950/50 backdrop:backdrop-blur-sm"
    >
      <figure className="p-3 sm:p-4">
        <div
          className="relative grid min-h-48 touch-pan-y place-items-center overflow-hidden rounded-2xl border-2 border-ink bg-indigo-950"
          onPointerDown={(e) => (swipeFrom.current = e.clientX)}
          onPointerUp={(e) => {
            const dx = swipeFrom.current === null ? 0 : e.clientX - swipeFrom.current;
            swipeFrom.current = null;
            if (Math.abs(dx) > 50 && shots.length > 1) go(dx < 0 ? 1 : -1);
          }}
        >
          <img
            key={shot.key}
            src={credit.data?.large ?? shot.large}
            alt={title}
            crossOrigin="anonymous"
            draggable={false}
            className="max-h-[62dvh] w-auto max-w-full animate-fade-in select-none object-contain"
          />
          {shots.length > 1 && (
            <>
              <ViewerButton label="Previous photo" onClick={() => go(-1)} className="left-2">
                <ChevronLeft className="size-5" strokeWidth={2.8} />
              </ViewerButton>
              <ViewerButton label="Next photo" onClick={() => go(1)} className="right-2">
                <ChevronRight className="size-5" strokeWidth={2.8} />
              </ViewerButton>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-2.5 py-0.5 text-[11.5px] font-bold text-white">
                {index + 1} / {shots.length}
              </span>
            </>
          )}
        </div>
        <figcaption className="px-1 pt-3">
          {shot.label && <div className="text-[11px] font-bold uppercase tracking-wide text-ink/50">{shot.label}</div>}
          <p className="text-[15px] font-bold leading-snug">{title}</p>
          <p className="mt-1.5 text-[12px] font-semibold leading-snug text-slate-500">
            📷{' '}
            {credit.isLoading ? (
              'Loading photo credit…'
            ) : (
              <>
                {credit.data?.artist ?? 'Unknown photographer'}
                {credit.data?.license && (
                  <>
                    {' · '}
                    {credit.data.licenseUrl ? (
                      <a href={credit.data.licenseUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
                        {credit.data.license}
                      </a>
                    ) : (
                      credit.data.license
                    )}
                  </>
                )}
                {credit.data?.page && (
                  <>
                    {' · '}
                    <a href={credit.data.page} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
                      Wikimedia Commons
                    </a>
                  </>
                )}
              </>
            )}
          </p>
          {shot.article && (
            <a
              href={shot.article}
              target="_blank"
              rel="noreferrer"
              className="toon-sm toon-press-sm mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-[12.5px] font-bold text-ink"
            >
              Read about it on Wikipedia
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </figcaption>
      </figure>
      <button
        type="button"
        onClick={() => ref.current?.close()}
        aria-label="Close"
        className="toon-sm toon-press-sm absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white text-ink hover:bg-pink-200 sm:right-6 sm:top-6"
      >
        <X className="size-4" strokeWidth={2.8} />
      </button>
    </dialog>
  );
}

function ViewerButton({ label, onClick, className, children }: { label: string; onClick: () => void; className: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx('toon-sm toon-press-sm absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-ink hover:bg-sun', className)}
    >
      {children}
    </button>
  );
}
