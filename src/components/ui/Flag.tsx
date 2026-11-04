import { useState } from 'react';
import clsx from 'clsx';
import type { Country } from '../../types';

interface FlagProps {
  country: Pick<Country, 'name' | 'flag'>;
  /** 'thumb' uses a small raster; 'full' uses the SVG at its natural aspect ratio. */
  variant?: 'thumb' | 'full';
  className?: string;
  eager?: boolean;
}

const thumbUrl = (png: string) => png.replace(/\/w\d+\//, '/w160/');

export function Flag({ country, variant = 'thumb', className, eager }: FlagProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = variant === 'full' ? country.flag.svg : thumbUrl(country.flag.png);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`Flag of ${country.name}`}
        className={clsx('inline-flex items-center justify-center bg-slate-100 text-base leading-none', className)}
      >
        {country.flag.emoji ?? '🏳️'}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={variant === 'full' ? (country.flag.alt ?? `Flag of ${country.name}`) : ''}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={clsx(
        'transition-opacity duration-300',
        variant === 'thumb' && 'bg-slate-100 object-cover',
        loaded ? 'opacity-100' : 'opacity-60',
        className,
      )}
    />
  );
}
