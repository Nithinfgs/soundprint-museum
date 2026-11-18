import React, { useRef, useEffect } from 'react';
import { Play, Pause, Dna, GitCompare, Activity } from 'lucide-react';
import { SoundExhibit, ExtinctionStatus } from './types';
import { SoundDnaRenderer } from './dnaRenderer';
import { playHapticSound } from './audioEngine';

interface SoundCardProps {
  exhibit: SoundExhibit;
  isPlaying: boolean;
  onTogglePlay: (exhibit: SoundExhibit) => void;
  onSelectForDna: (exhibit: SoundExhibit) => void;
  onSelectForCompare: (exhibit: SoundExhibit) => void;
  isQueuedForCompare?: boolean;
}

const EXTINCTION_BADGES: Record<ExtinctionStatus, { label: string; text: string; border: string; bg: string }> = {
  vulnerable: {
    label: 'Vulnerable',
    text: 'text-[#A5BC94]',
    border: 'border-[#A5BC94]/40',
    bg: 'bg-[#A5BC94]/10'
  },
  endangered: {
    label: 'Endangered',
    text: 'text-[#C8A45D]',
    border: 'border-[#C8A45D]/40',
    bg: 'bg-[#C8A45D]/10'
  },
  critically_endangered: {
    label: 'Critically Endangered',
    text: 'text-[#C8A45D]',
    border: 'border-[#C8A45D]/40',
    bg: 'bg-[#C8A45D]/10'
  },
  extinct_in_daily_life: {
    label: 'Extinct in Daily Life',
    text: 'text-[#D97757]',
    border: 'border-[#D97757]/40',
    bg: 'bg-[#D97757]/10'
  }
};

export const SoundCard: React.FC<SoundCardProps> = ({
  exhibit,
  isPlaying,
  onTogglePlay,
  onSelectForDna,
  onSelectForCompare,
  isQueuedForCompare
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SoundDnaRenderer | null>(null);

  // Render mini DNA canvas
  useEffect(() => {
    if (canvasRef.current) {
      if (!rendererRef.current) {
        rendererRef.current = new SoundDnaRenderer(canvasRef.current);
      }
      rendererRef.current.renderFrame(exhibit.dna, exhibit.analysis, null, isPlaying);
    }
  }, [exhibit, isPlaying]);

  const badge = EXTINCTION_BADGES[exhibit.extinctionStatus];
  const catalogCode = `ARC-${exhibit.year}-${exhibit.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}`;

  return (
    <div
      className={`bg-[#1C1E1B] rounded-[2px] p-5 flex flex-col justify-between border transition-all relative group ${
        isPlaying
          ? 'border-[#C8A45D] ring-1 ring-[#C8A45D]/20 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'border-[#2A2D28] hover:border-[#C8A45D]/50 hover:bg-[#20221F]'
      }`}
    >
      {/* Top Archival Header Strip */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#2A2D28] text-[10px] font-mono tracking-wider">
          <div className="flex items-center gap-2 text-[#96988E]">
            <span className="text-[#C8A45D] font-medium">{catalogCode}</span>
            <span>//</span>
            <span className="uppercase">{exhibit.category}</span>
          </div>

          <span className={`px-2 py-0.5 rounded-[2px] border ${badge.border} ${badge.text} ${badge.bg} flex items-center gap-1.5 uppercase`}>
            <span className={`w-1 h-1 rounded-full ${isPlaying ? 'bg-[#A5BC94] animate-pulse' : 'bg-current'}`} />
            {badge.label}
          </span>
        </div>

        {/* Title & Curatorial Metadata */}
        <h3 className="text-base font-medium font-display text-[#F0E8D6] group-hover:text-[#C8A45D] transition-colors line-clamp-1 leading-snug">
          {exhibit.title}
        </h3>

        <div className="text-[11px] font-mono text-[#96988E] mt-1 flex items-center gap-2">
          <span>ORIGIN: {exhibit.recordedLocation}</span>
          <span>•</span>
          <span>{exhibit.era}</span>
        </div>

        <p className="text-xs text-[#96988E] mt-2 line-clamp-2 leading-relaxed font-sans font-light">
          {exhibit.historicalContext}
        </p>
      </div>

      {/* Oscilloscope Viewport & Sound DNA Preview */}
      <div className="relative my-4 rounded-[2px] overflow-hidden bg-[#151614] border border-[#2A2D28] h-36 flex items-center justify-center">
        {/* Subtle Crosshairs in Corners */}
        <span className="absolute top-1.5 left-2 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>
        <span className="absolute top-1.5 right-2 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>
        <span className="absolute bottom-1.5 left-2 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>

        <canvas
          ref={canvasRef}
          width={280}
          height={144}
          className="w-full h-full object-contain cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
          onClick={() => {
            playHapticSound('toggle');
            onSelectForDna(exhibit);
          }}
          title="Click to examine Sound DNA in laboratory"
        />

        {/* Tactile Audio Playback Trigger */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound(isPlaying ? 'toggle' : 'confirm');
            onTogglePlay(exhibit);
          }}
          className={`absolute bottom-2.5 right-2.5 h-8 px-3 rounded-[2px] flex items-center gap-1.5 text-xs font-mono transition-all border active:scale-95 ${
            isPlaying
              ? 'bg-[#C8A45D] text-[#111210] border-[#C8A45D] font-medium'
              : 'bg-[#1C1E1B] text-[#F0E8D6] border-[#2A2D28] hover:border-[#C8A45D] hover:text-[#C8A45D]'
          }`}
          aria-label={isPlaying ? 'Pause sound' : 'Play sound'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>PLAY</span>
            </>
          )}
        </button>

        {/* Oscilloscope Live Telemetry Tag */}
        {isPlaying && (
          <div className="absolute top-2.5 left-2.5 bg-[#1C1E1B]/95 border border-[#A5BC94]/50 px-2 py-0.5 rounded-[2px] flex items-center gap-1.5 text-[9px] font-mono text-[#A5BC94] tracking-wider">
            <Activity className="w-2.5 h-2.5 text-[#A5BC94] animate-pulse" />
            <span>LIVE SIGNAL</span>
          </div>
        )}
      </div>

      {/* Engineering Acoustic Telemetry Strip */}
      <div>
        <div className="grid grid-cols-3 border-t border-b border-[#2A2D28] py-2 text-[10px] font-mono text-[#96988E] mb-3 divide-x divide-[#2A2D28]">
          <div className="px-1 first:pl-0">
            <div className="text-[9px] uppercase tracking-wider text-[#96988E]/70">Centroid</div>
            <div className="text-[#F0E8D6] font-medium mt-0.5">{exhibit.analysis.spectralCentroid} Hz</div>
          </div>
          <div className="px-2">
            <div className="text-[9px] uppercase tracking-wider text-[#96988E]/70">Dominant</div>
            <div className="text-[#F0E8D6] font-medium mt-0.5">{exhibit.analysis.dominantFrequency} Hz</div>
          </div>
          <div className="px-2 last:pr-0">
            <div className="text-[9px] uppercase tracking-wider text-[#96988E]/70">Duration</div>
            <div className="text-[#F0E8D6] font-medium mt-0.5">{exhibit.duration}s</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playHapticSound('click');
              onSelectForDna(exhibit);
            }}
            className="flex-1 bg-[#151614] hover:bg-[#20221F] text-[#F0E8D6] hover:text-[#C8A45D] text-xs py-1.5 px-3 rounded-[2px] border border-[#2A2D28] hover:border-[#C8A45D]/40 transition-all flex items-center justify-center gap-1.5 font-mono text-[11px]"
          >
            <Dna className="w-3 h-3 text-[#C8A45D]" />
            <span>EXAMINE DNA →</span>
          </button>

          <button
            onClick={() => {
              playHapticSound('click');
              onSelectForCompare(exhibit);
            }}
            className={`text-xs py-1.5 px-3 rounded-[2px] border transition-all flex items-center justify-center gap-1.5 font-mono text-[11px] ${
              isQueuedForCompare
                ? 'bg-[#C8A45D]/15 text-[#C8A45D] border-[#C8A45D]'
                : 'bg-[#151614] hover:bg-[#20221F] text-[#96988E] hover:text-[#F0E8D6] border-[#2A2D28] hover:border-[#383B34]'
            }`}
            title="Queue for side-by-side acoustic comparison"
          >
            <GitCompare className="w-3 h-3" />
            <span>{isQueuedForCompare ? 'QUEUED ✓' : 'COMPARE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
