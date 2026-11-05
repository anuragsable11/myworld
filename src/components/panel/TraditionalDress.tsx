import { useState } from 'react';
import type { Country } from '../../types';
import { costumeFor } from '../../data/costumes';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { Figure, type FigureProps } from './dress/Figure';

/** A figure that jumps for joy when tapped. */
function Person({ label, ...figure }: Omit<FigureProps, 'happy'> & { label: string }) {
  const [jumps, setJumps] = useState(0);
  const [happy, setHappy] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        haptics.hop();
        sounds.boing();
        setJumps((n) => n + 1);
        setHappy(true);
      }}
      className="h-[243px] w-[128px] cursor-pointer rounded-2xl"
    >
      <div
        key={jumps}
        className={jumps ? 'size-full origin-bottom animate-hop' : 'size-full'}
        onAnimationEnd={(e) => e.target === e.currentTarget && setHappy(false)}
      >
        <Figure {...figure} happy={happy} />
      </div>
    </button>
  );
}

/** "Traditional dress" card for the People section: a cartoon man and woman with garment names. */
export function TraditionalDress({ country }: { country: Country }) {
  const c = costumeFor(country);
  const caption =
    c.note ??
    (c.illustrative
      ? `Illustrative: inspired by traditional dress across ${c.regionName}.`
      : 'Simplified cartoon. Traditional dress varies by region and is mostly worn on festivals and special days.');

  return (
    <div className="toon relative overflow-hidden rounded-3xl bg-[linear-gradient(180deg,#d8f1ff_0%,#fff7e6_100%)] px-3 pb-3 pt-4">
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-[#c8ec7a] [clip-path:ellipse(70%_100%_at_50%_100%)] opacity-70" />
      <div className="relative flex items-end justify-center gap-1" role="group" aria-label={`Cartoon of traditional dress in ${country.name}`}>
        <Person label="Make the man jump" outfit={c.man} skin={c.skin[0]} hairColor={c.hair[0]} female={false} wave="left" />
        <Person label="Make the woman jump" outfit={c.woman} skin={c.skin[1]} hairColor={c.hair[1]} female wave="right" delay={1.3} />
      </div>
      {!c.note && c.labels && (
        <div className="relative mt-2 grid grid-cols-2 gap-2 text-center">
          {(['man', 'woman'] as const).map((who) => (
            <div key={who} className="toon-sm rounded-2xl bg-white px-2 py-1.5">
              <div className="text-[10.5px] font-black uppercase tracking-wide text-ink/50">{who === 'man' ? '👨 Men' : '👩 Women'}</div>
              <div className="text-[13px] font-extrabold leading-tight text-ink">{c.labels?.[who] ?? 'Traditional dress'}</div>
            </div>
          ))}
        </div>
      )}
      <p className="relative mt-2.5 text-center text-[11.5px] font-semibold leading-snug text-slate-500">{caption}</p>
    </div>
  );
}
