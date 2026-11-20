import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowUpRight, Camera, ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
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
                <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_2px_8px_rgb(0_0_0/0.08)] transition-transform duration-300 group-hover:scale-105">
                  <Picture src={s.thumb} className="aspect-square" />
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] text-secondary">{s.tag}</div>
                <div className="line-clamp-2 text-[13px] font-medium leading-tight text-label">{s.title}</div>
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
                  'ios-press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
                  on ? 'bg-tint text-white' : 'bg-control text-label hover:bg-control-strong',
                )}
              >
                {g.label}
                <span className={clsx('ml-1 font-medium', on ? 'text-white/75' : 'text-secondary')}>{all.filter((p) => p.group === g.id).length}</span>
              </button>
            );
          })}
        </div>
      )}

      {loadingPhotos ? (
        <div className="mt-2 grid grid-cols-2 gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[4/3.6] w-full rounded-[16px]" />
          ))}
        </div>
      ) : shots.length ? (
        <div key={group?.id} className="mt-2 grid grid-cols-2 gap-x-3.5 gap-y-4">
          {shots.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setViewing({ shots, index: i })}
              className="relative block w-full animate-pop text-left transition-transform duration-300 hover:z-10 hover:scale-[1.03]"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <Picture src={s.thumb} className="aspect-[4/3] rounded-[16px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_2px_10px_rgb(0_0_0/0.1)]" />
              {s.title ? (
                <span className="mt-1.5 line-clamp-2 px-0.5 text-[12px] leading-snug text-secondary">{s.title}</span>
              ) : (
                <span aria-hidden className="block h-4" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-secondary">
          {nothing ? `No pictures of ${country.name} yet.` : 'No photos found in this country’s article.'}
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
      <span aria-hidden className={clsx('grid w-full place-items-center bg-control text-tertiary', className)}>
        <ImageOff className="size-7" strokeWidth={1.8} />
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
      className={clsx('block w-full bg-control object-cover', className)}
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
      className="m-auto w-[min(94vw,720px)] animate-pop rounded-[30px] border-0 bg-white/85 p-0 text-label shadow-[0_24px_70px_rgb(0_0_0/0.3)] backdrop-blur-2xl backdrop-saturate-150 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <figure className="p-3 sm:p-4">
        <div
          className="relative grid min-h-48 touch-pan-y place-items-center overflow-hidden rounded-[20px] bg-black"
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
                <ChevronLeft className="size-5" strokeWidth={2.5} />
              </ViewerButton>
              <ViewerButton label="Next photo" onClick={() => go(1)} className="right-2">
                <ChevronRight className="size-5" strokeWidth={2.5} />
              </ViewerButton>
              <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-[12px] font-semibold text-white backdrop-blur-md">
                {index + 1} / {shots.length}
              </span>
            </>
          )}
        </div>
        <figcaption className="px-1 pt-3">
          {shot.label && <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-secondary">{shot.label}</div>}
          <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">{title}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-secondary">
            <Camera aria-hidden className="mr-1 inline size-3.5 -translate-y-px" strokeWidth={2.2} />
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
              className="ios-press mt-3 inline-flex items-center gap-1 rounded-full bg-tint/12 px-3.5 py-1.5 text-[14px] font-semibold text-tint"
            >
              Read about it on Wikipedia
              <ArrowUpRight className="size-4" strokeWidth={2.3} />
            </a>
          )}
        </figcaption>
      </figure>
      <button
        type="button"
        onClick={() => ref.current?.close()}
        aria-label="Close"
        className="ios-press absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/60 sm:right-6 sm:top-6"
      >
        <X className="size-[18px]" strokeWidth={2.6} />
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
      className={clsx('ios-press absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/75 text-label shadow-[0_2px_10px_rgb(0_0_0/0.2)] backdrop-blur-md hover:bg-white/90', className)}
    >
      {children}
    </button>
  );
}
