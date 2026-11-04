import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { restoreNameCase } from '../../../lib/sources/factbook';
import { ExpandableText, Fact, FactGrid } from '../../ui/primitives';
import { capitalize, type CountryDetails } from '../details';
import { Section } from '../Section';

function AnthemPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setFailed(true);
      }
    } else audio.pause();
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-ink bg-amber-50 p-2 pr-3.5">
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? 'Pause anthem' : 'Play anthem'}
        className="toon-sm toon-press-sm grid size-10 shrink-0 place-items-center rounded-full bg-sun text-ink disabled:bg-slate-200 disabled:text-slate-400"
      >
        {playing ? <Pause className="size-3.5" fill="currentColor" /> : <Play className="ml-0.5 size-3.5" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-ink">
          {failed ? 'This recording cannot be played in this browser' : playing ? '🎶 Playing…' : '🎺 Listen to the anthem'}
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-white">
          <div className="h-full rounded-full bg-amber-400 transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress(a.currentTime / a.duration);
        }}
      />
    </div>
  );
}

function People({
  people,
  office,
  fallback,
}: {
  people: { id: string; name: string }[] | undefined;
  office?: string;
  fallback?: string;
}) {
  if (people?.length) {
    return (
      <>
        {people.map((p) => p.name).join(' & ')}
        {office && <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{office}</div>}
      </>
    );
  }
  return fallback ? <ExpandableText text={restoreNameCase(fallback)} lines={3} /> : undefined;
}

export function Government({ country, factbook, wikidata }: CountryDetails) {
  const fb = factbook.data;
  const wd = wikidata.data;
  const govType = fb?.governmentType ?? country.governmentType;
  const anthemTitle = wd?.anthem?.title ?? fb?.anthem?.title;

  return (
    <Section tone="amber" order={2} id="government" title="Government" emoji="🏛️" source="Wikidata (current office holders), CIA World Factbook">
      <FactGrid>
        <Fact label="Government type" wide loading={factbook.loading}>
          {govType && capitalize(govType)}
        </Fact>
        <Fact label="Head of state" loading={wikidata.loading || factbook.loading}>
          {People({ people: wd?.headsOfState, office: wd?.headOfStateOffice, fallback: fb?.chiefOfState })}
        </Fact>
        <Fact label="Head of government" loading={wikidata.loading || factbook.loading}>
          {People({ people: wd?.headsOfGovernment, office: wd?.headOfGovernmentOffice, fallback: fb?.headOfGovernment })}
        </Fact>
        <Fact label="Independence" wide loading={factbook.loading}>
          {fb?.independence && <ExpandableText text={capitalize(fb.independence)} lines={3} />}
        </Fact>
        <Fact label="National holiday" wide loading={factbook.loading}>
          {fb?.nationalHoliday}
        </Fact>
        <Fact label="National anthem" wide loading={wikidata.loading || factbook.loading}>
          {anthemTitle && (
            <>
              <span className="font-display text-[17px] font-semibold">{anthemTitle.replace(/^"|"$/g, '')}</span>
              {fb?.anthem?.composers && (
                <div className="mt-0.5 text-[12px] text-slate-500">Lyrics/music: {restoreNameCase(fb.anthem.composers)}</div>
              )}
              {wd?.anthem?.audioUrl && <AnthemPlayer key={wd.anthem.audioUrl} src={wd.anthem.audioUrl} />}
            </>
          )}
        </Fact>
      </FactGrid>
    </Section>
  );
}
