import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Volume2, VolumeX, Search, Dna, GitCompare, Landmark,
  Plus, X, ShieldAlert, Radio, Activity, Play, Pause, ChevronRight
} from 'lucide-react';
import { SoundExhibit, SoundCategory, ExtinctionStatus } from './types';
import { CURATED_EXHIBITS } from './museumData';
import { SoundCard } from './SoundCard';
import { SoundDNALab } from './SoundDNALab';
import { ComparisonLab } from './ComparisonLab';
import { SoundDnaRenderer } from './dnaRenderer';
import {
  SoundMuseumPlayer, playHapticSound
} from './audioEngine';

type ActiveTab = 'museum' | 'dna-lab' | 'compare';

const STORAGE_KEY = 'soundprint_museum_custom_exhibits';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('museum');
  const [customExhibits, setCustomExhibits] = useState<SoundExhibit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const allExhibits = useMemo(() => {
    return [...customExhibits, ...CURATED_EXHIBITS];
  }, [customExhibits]);

  // Audio Player State
  const player = SoundMuseumPlayer.getInstance();
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SoundCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ExtinctionStatus | 'all'>('all');

  // Selected exhibit for Sound DNA Lab modal / deep dive
  const [dnaTargetExhibit, setDnaTargetExhibit] = useState<SoundExhibit | null>(allExhibits[0]);

  // Comparison Lab Queue
  const [compareAId, setCompareAId] = useState<string>(allExhibits[1]?.id || 'remington-typewriter');
  const [compareBId, setCompareBId] = useState<string>(allExhibits[0]?.id || 'modem-56k');

  // Cmd+K Command Palette State
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Featured specimen for hero section
  const featuredExhibit = allExhibits[0];
  const featuredCanvasRef = useRef<HTMLCanvasElement>(null);
  const featuredRendererRef = useRef<SoundDnaRenderer | null>(null);

  // Synchronize player callbacks
  useEffect(() => {
    const unsub = player.setListener((playing, soundId) => {
      setIsPlaying(playing);
      setCurrentPlayingId(soundId);
    });
    return () => unsub();
  }, [player]);

  // Handle master volume changes
  const handleVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    setIsMuted(vol === 0);
    player.setVolume(vol);
  };

  const toggleMute = () => {
    playHapticSound('toggle');
    if (isMuted) {
      setIsMuted(false);
      player.setVolume(masterVolume || 0.85);
    } else {
      setIsMuted(true);
      player.setVolume(0);
    }
  };

  // Keyboard shortcut listener (Cmd+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        playHapticSound('toggle');
        setIsCommandOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered exhibits
  const filteredExhibits = useMemo(() => {
    return allExhibits.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.historicalContext.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || item.extinctionStatus === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allExhibits, searchQuery, selectedCategory, selectedStatus]);

  // Category counts for archive tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allExhibits.length };
    allExhibits.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [allExhibits]);

  // Featured exhibit live canvas update
  useEffect(() => {
    if (featuredCanvasRef.current && featuredExhibit) {
      if (!featuredRendererRef.current) {
        featuredRendererRef.current = new SoundDnaRenderer(featuredCanvasRef.current);
      }
      featuredRendererRef.current.renderFrame(
        featuredExhibit.dna,
        featuredExhibit.analysis,
        null,
        isPlaying && currentPlayingId === featuredExhibit.id
      );
    }
  }, [featuredExhibit, isPlaying, currentPlayingId]);

  // Play / Pause toggle for any exhibit
  const handleTogglePlay = async (exhibit: SoundExhibit) => {
    if (currentPlayingId === exhibit.id && isPlaying) {
      player.stop();
    } else {
      try {
        let buffer: AudioBuffer;
        if (exhibit.audioPresetId) {
          buffer = await player.getAudioBufferForPreset(exhibit.audioPresetId);
        } else if (exhibit.audioUrl) {
          const resp = await fetch(exhibit.audioUrl);
          const ab = await resp.arrayBuffer();
          buffer = await player.decodeAudioFile(new File([ab], 'audio'));
        } else {
          return;
        }
        await player.play(exhibit.id, buffer);
      } catch (err) {
        console.error('Playback error:', err);
      }
    }
  };

  // Save new custom exhibit
  const handleArchiveNewSound = (newExhibit: SoundExhibit) => {
    const updated = [newExhibit, ...customExhibits];
    setCustomExhibits(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage quota or private mode fallback
    }
  };

  // Select exhibit to inspect in DNA Lab
  const handleSelectForDna = (exhibit: SoundExhibit) => {
    setDnaTargetExhibit(exhibit);
    setActiveTab('dna-lab');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Queue exhibit for Comparison
  const handleSelectForCompare = (exhibit: SoundExhibit) => {
    if (compareAId !== exhibit.id) {
      setCompareBId(compareAId);
      setCompareAId(exhibit.id);
    }
    setActiveTab('compare');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#111210] text-[#F0E8D6] flex flex-col font-sans selection:bg-[#C8A45D]/25 selection:text-[#F0E8D6]">
      {/* Editorial Museum Navbar */}
      <header className="sticky top-0 z-40 bg-[#111210]/95 backdrop-blur-md border-b border-[#2A2D28] px-4 sm:px-6 lg:px-8 py-3 transition-colors w-full min-w-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 w-full min-w-0">
          {/* Logo & Archival Identity */}
          <div
            onClick={() => {
              playHapticSound('click');
              setActiveTab('museum');
            }}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-8 h-8 rounded-[2px] bg-[#1C1E1B] border border-[#C8A45D]/60 flex items-center justify-center text-[#C8A45D] font-mono text-xs font-semibold">
              SP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium tracking-tight font-display text-[#F0E8D6] group-hover:text-[#C8A45D] transition-colors">
                  SOUNDPRINT ARCHIVE
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#1C1E1B] border border-[#2A2D28] text-[#96988E]">
                  VOL. 2026
                </span>
              </div>
              <span className="text-[10px] text-[#96988E] block font-mono tracking-wider -mt-0.5">
                MUSEUM OF DISAPPEARING ACOUSTICS
              </span>
            </div>
          </div>

          {/* Understated Section Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => {
                playHapticSound('toggle');
                setActiveTab('museum');
              }}
              className={`py-1 text-xs font-mono tracking-wider transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'museum'
                  ? 'text-[#F0E8D6] font-medium'
                  : 'text-[#96988E] hover:text-[#F0E8D6]'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>01. CATALOGUE</span>
              {activeTab === 'museum' && (
                <span className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[#C8A45D]" />
              )}
            </button>

            <button
              onClick={() => {
                playHapticSound('toggle');
                setActiveTab('dna-lab');
              }}
              className={`py-1 text-xs font-mono tracking-wider transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'dna-lab'
                  ? 'text-[#F0E8D6] font-medium'
                  : 'text-[#96988E] hover:text-[#F0E8D6]'
              }`}
            >
              <Dna className="w-3.5 h-3.5" />
              <span>02. SOUND DNA LAB</span>
              {activeTab === 'dna-lab' && (
                <span className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[#C8A45D]" />
              )}
            </button>

            <button
              onClick={() => {
                playHapticSound('toggle');
                setActiveTab('compare');
              }}
              className={`py-1 text-xs font-mono tracking-wider transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'compare'
                  ? 'text-[#F0E8D6] font-medium'
                  : 'text-[#96988E] hover:text-[#F0E8D6]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>03. COMPARATIVE BENCH</span>
              {activeTab === 'compare' && (
                <span className="absolute -bottom-3 left-0 right-0 h-[2px] bg-[#C8A45D]" />
              )}
            </button>
          </nav>

          {/* Right Header Controls: Integrated Search, Volume, Preserve Action */}
          <div className="flex items-center gap-3">
            {/* Minimalist Command Palette Trigger */}
            <button
              onClick={() => {
                playHapticSound('click');
                setIsCommandOpen(true);
              }}
              className="hidden lg:flex items-center gap-2 bg-[#1C1E1B] hover:bg-[#242723] text-[#96988E] hover:text-[#F0E8D6] border border-[#2A2D28] px-2.5 py-1.5 rounded-[2px] text-xs font-mono transition-all"
              title="Search archive (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-[#96988E]" />
              <span className="text-[11px]">INDEX SEARCH</span>
              <kbd className="bg-[#111210] px-1 py-0.5 rounded-[2px] text-[10px] text-[#96988E] border border-[#2A2D28]">⌘K</kbd>
            </button>

            {/* Compact Archival Volume Meter */}
            <div className="flex items-center gap-2 bg-[#1C1E1B] border border-[#2A2D28] px-2.5 py-1 rounded-[2px]">
              <button
                onClick={toggleMute}
                className="text-[#96988E] hover:text-[#F0E8D6] transition-colors"
                aria-label="Toggle Master Audio Mute"
              >
                {isMuted || masterVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-[#D97757]" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#C8A45D]" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : masterVolume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-14 accent-[#C8A45D] bg-[#2A2D28] h-1 rounded-none appearance-none cursor-pointer"
                aria-label="Master Output Volume"
              />
              <span className="text-[10px] font-mono text-[#96988E] w-6 text-right">
                {isMuted ? '0%' : `${Math.round(masterVolume * 100)}%`}
              </span>
            </div>

            {/* Archival Accession Button */}
            <button
              onClick={() => {
                playHapticSound('confirm');
                setActiveTab('dna-lab');
              }}
              className="bg-[#1C1E1B] hover:bg-[#C8A45D]/10 text-[#C8A45D] border border-[#C8A45D]/50 text-xs font-mono px-3 py-1.5 rounded-[2px] flex items-center gap-1.5 transition-all active:scale-98"
            >
              <Plus className="w-3 h-3 text-[#C8A45D]" />
              <span className="hidden sm:inline">ACCESSION SPECIMEN</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden items-center justify-around pt-2.5 mt-2 border-t border-[#2A2D28] font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('museum')}
            className={`py-1 px-2 border-b-2 transition-colors ${
              activeTab === 'museum' ? 'border-[#C8A45D] text-[#F0E8D6] font-medium' : 'border-transparent text-[#96988E]'
            }`}
          >
            01. CATALOGUE
          </button>
          <button
            onClick={() => setActiveTab('dna-lab')}
            className={`py-1 px-2 border-b-2 transition-colors ${
              activeTab === 'dna-lab' ? 'border-[#C8A45D] text-[#F0E8D6] font-medium' : 'border-transparent text-[#96988E]'
            }`}
          >
            02. DNA LAB
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`py-1 px-2 border-b-2 transition-colors ${
              activeTab === 'compare' ? 'border-[#C8A45D] text-[#F0E8D6] font-medium' : 'border-transparent text-[#96988E]'
            }`}
          >
            03. COMPARE
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 min-w-0">
        {/* VIEW 1: Museum Archive Exhibits */}
        {activeTab === 'museum' && (
          <div className="space-y-6">
            {/* Asymmetrical Editorial Hero Section */}
            <section className="bg-[#1C1E1B] border border-[#2A2D28] rounded-[2px] p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left Column: Curatorial Header & Statement */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#96988E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A45D]" />
                    <span className="uppercase text-[#C8A45D]">ACOUSTIC ARCHAEOLOGY INITIATIVE</span>
                    <span>//</span>
                    <span>ARCH-RECORD 2026</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-medium font-display tracking-tight text-[#F0E8D6] leading-[1.08]">
                    Before the world went quiet.
                  </h1>

                  <p className="text-sm text-[#96988E] leading-relaxed max-w-xl font-light">
                    The digital archive of vanishing mechanical, telecommunication, and early computing acoustics.
                    As physical relays, phosphor flybacks, and copper handshakes yield to silent solid-state silicon,
                    these tactile sound signatures are captured and catalogued as permanent generative Sound DNA.
                  </p>

                  {/* Minimal Archival Metadata Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[#2A2D28] pt-4 mt-4 gap-4 text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-[#96988E] uppercase tracking-wider">SPECIMENS</div>
                      <div className="text-lg font-medium text-[#F0E8D6] mt-0.5">{allExhibits.length} CATALOGUED</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#96988E] uppercase tracking-wider">CHRONOLOGY</div>
                      <div className="text-lg font-medium text-[#F0E8D6] mt-0.5">1912 — 2026</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#96988E] uppercase tracking-wider">SYNTHESIS</div>
                      <div className="text-lg font-medium text-[#C8A45D] mt-0.5">100% ACOUSTIC</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#96988E] uppercase tracking-wider">EXTINCT CLASS</div>
                      <div className="text-lg font-medium text-[#D97757] mt-0.5">
                        {allExhibits.filter((e) => e.extinctionStatus === 'extinct_in_daily_life').length} CONFIRMED
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Featured Real Artifact Specimen with Audio Visualization */}
                {featuredExhibit && (
                  <div className="lg:col-span-5 bg-[#151614] border border-[#2A2D28] rounded-[2px] p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2A2D28] text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-[#C8A45D]">
                        <Activity className="w-3 h-3 text-[#C8A45D]" />
                        <span>FEATURED SPECIMEN</span>
                      </div>
                      <span className="text-[#96988E]">ARC-{featuredExhibit.year}-001</span>
                    </div>

                    <div className="space-y-1 mb-3">
                      <h2 className="text-base font-medium font-display text-[#F0E8D6] line-clamp-1">
                        {featuredExhibit.title}
                      </h2>
                      <p className="text-[11px] font-mono text-[#96988E]">
                        {featuredExhibit.recordedLocation} • {featuredExhibit.era}
                      </p>
                    </div>

                    {/* Live Oscilloscope Radar Display */}
                    <div className="relative rounded-[2px] overflow-hidden bg-[#111210] border border-[#2A2D28] h-32 flex items-center justify-center my-2">
                      <canvas
                        ref={featuredCanvasRef}
                        width={300}
                        height={128}
                        className="w-full h-full object-contain cursor-pointer opacity-90"
                        onClick={() => handleSelectForDna(featuredExhibit)}
                        title="Click to analyze featured specimen in DNA Lab"
                      />
                      {isPlaying && currentPlayingId === featuredExhibit.id && (
                        <div className="absolute top-2 left-2 bg-[#1C1E1B] border border-[#A5BC94]/50 px-2 py-0.5 rounded-[2px] flex items-center gap-1 text-[9px] font-mono text-[#A5BC94]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A5BC94] animate-pulse" />
                          <span>AUDITIONING</span>
                        </div>
                      )}
                    </div>

                    {/* Integrated Audio Trigger & Telemetry */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#2A2D28] gap-3 text-[11px] font-mono">
                      <div className="text-[#96988E] text-[10px]">
                        SPECTRAL: {featuredExhibit.analysis.spectralCentroid}Hz // {featuredExhibit.duration}s
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePlay(featuredExhibit)}
                          className={`px-3 py-1 text-xs font-mono rounded-[2px] border transition-all flex items-center gap-1.5 ${
                            isPlaying && currentPlayingId === featuredExhibit.id
                              ? 'bg-[#C8A45D] text-[#111210] border-[#C8A45D] font-medium'
                              : 'bg-[#1C1E1B] hover:bg-[#20221F] text-[#F0E8D6] border-[#2A2D28] hover:border-[#C8A45D]'
                          }`}
                        >
                          {isPlaying && currentPlayingId === featuredExhibit.id ? (
                            <>
                              <Pause className="w-3 h-3 fill-current" />
                              <span>PAUSE</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                              <span>AUDITION</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleSelectForDna(featuredExhibit)}
                          className="px-2 py-1 text-xs font-mono text-[#96988E] hover:text-[#C8A45D] border border-transparent hover:border-[#2A2D28] rounded-[2px]"
                          title="Examine in DNA Lab"
                        >
                          DETAILS →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Archive Filtering & Index Toolbar */}
            <div className="bg-[#1C1E1B] border border-[#2A2D28] rounded-[2px] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Category Index Navigation */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-mono">
                {(
                  [
                    { id: 'all', label: 'ALL SPECIMENS' },
                    { id: 'computing', label: 'COMPUTING' },
                    { id: 'mechanical', label: 'MECHANICAL' },
                    { id: 'telecom', label: 'TELECOM' },
                    { id: 'media', label: 'MEDIA & AUDIO' }
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      playHapticSound('click');
                      setSelectedCategory(cat.id);
                    }}
                    className={`px-2.5 py-1 rounded-[2px] transition-colors whitespace-nowrap border ${
                      selectedCategory === cat.id
                        ? 'bg-[#2A2D28] border-[#C8A45D] text-[#F0E8D6] font-medium'
                        : 'bg-transparent border-transparent text-[#96988E] hover:text-[#F0E8D6] hover:bg-[#212420]'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="ml-1.5 opacity-60">[{categoryCounts[cat.id] || 0}]</span>
                  </button>
                ))}
              </div>

              {/* Status & Search Controls */}
              <div className="flex items-center gap-2.5">
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    playHapticSound('toggle');
                    setSelectedStatus(e.target.value as ExtinctionStatus | 'all');
                  }}
                  className="bg-[#151614] border border-[#2A2D28] text-[#F0E8D6] text-xs font-mono rounded-[2px] px-2.5 py-1.5 focus:outline-none focus:border-[#C8A45D]"
                >
                  <option value="all">ALL EXTINCTION TIERS</option>
                  <option value="extinct_in_daily_life">EXTINCT IN DAILY LIFE</option>
                  <option value="critically_endangered">CRITICALLY ENDANGERED</option>
                  <option value="endangered">ENDANGERED</option>
                  <option value="vulnerable">VULNERABLE</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#96988E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="FILTER ARCHIVE..."
                    className="bg-[#151614] border border-[#2A2D28] rounded-[2px] pl-8 pr-3 py-1.5 text-xs font-mono text-[#F0E8D6] placeholder:text-[#96988E]/60 focus:outline-none focus:border-[#C8A45D] w-36 sm:w-48"
                  />
                </div>
              </div>
            </div>

            {/* Exhibit Specimen Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExhibits.map((exhibit) => (
                <SoundCard
                  key={exhibit.id}
                  exhibit={exhibit}
                  isPlaying={isPlaying && currentPlayingId === exhibit.id}
                  onTogglePlay={handleTogglePlay}
                  onSelectForDna={handleSelectForDna}
                  onSelectForCompare={handleSelectForCompare}
                  isQueuedForCompare={compareAId === exhibit.id || compareBId === exhibit.id}
                />
              ))}
            </div>

            {/* Empty State */}
            {filteredExhibits.length === 0 && (
              <div className="bg-[#1C1E1B] rounded-[2px] p-12 text-center space-y-3 border border-[#2A2D28]">
                <ShieldAlert className="w-8 h-8 text-[#96988E] mx-auto" />
                <h3 className="text-base font-medium font-display text-[#F0E8D6]">
                  No matching acoustic specimens located
                </h3>
                <p className="text-xs text-[#96988E] max-w-sm mx-auto font-mono">
                  Modify current search query or extinction criteria to query the full archive holdings.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedStatus('all');
                  }}
                  className="mt-2 text-xs font-mono text-[#C8A45D] hover:underline"
                >
                  RESET CATALOG FILTERS →
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Sound DNA Generator & Lab */}
        {activeTab === 'dna-lab' && (
          <SoundDNALab
            initialExhibit={dnaTargetExhibit}
            onArchiveNewSound={handleArchiveNewSound}
            onClose={() => setActiveTab('museum')}
          />
        )}

        {/* VIEW 3: Comparison Lab */}
        {activeTab === 'compare' && (
          <ComparisonLab
            exhibits={allExhibits}
            initialSoundAId={compareAId}
            initialSoundBId={compareBId}
            onSelectForDna={handleSelectForDna}
          />
        )}
      </main>

      {/* Universal Cmd+K Command Palette Modal */}
      {isCommandOpen && (
        <div
          onClick={() => setIsCommandOpen(false)}
          className="fixed inset-0 z-50 bg-[#111210]/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[#1C1E1B] rounded-[2px] border border-[#2A2D28] overflow-hidden shadow-2xl"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 p-3.5 border-b border-[#2A2D28]">
              <Search className="w-4 h-4 text-[#C8A45D]" />
              <input
                autoFocus
                type="text"
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Query specimen by title, category, or year..."
                className="w-full bg-transparent text-[#F0E8D6] placeholder:text-[#96988E] text-xs font-mono focus:outline-none"
              />
              <button
                onClick={() => setIsCommandOpen(false)}
                className="text-[#96988E] hover:text-[#F0E8D6] p-1 rounded-[2px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1 font-mono">
              <div className="text-[10px] text-[#96988E] uppercase px-3 py-1">
                SECTIONS & INSTRUMENTATION
              </div>
              <button
                onClick={() => {
                  playHapticSound('click');
                  setActiveTab('museum');
                  setIsCommandOpen(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-[2px] hover:bg-[#242723] text-left text-xs text-[#F0E8D6] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Landmark className="w-3.5 h-3.5 text-[#C8A45D]" />
                  <span>01. Museum Catalogue</span>
                </div>
                <span className="text-[10px] text-[#96988E]">INDEX</span>
              </button>

              <button
                onClick={() => {
                  playHapticSound('click');
                  setActiveTab('dna-lab');
                  setIsCommandOpen(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-[2px] hover:bg-[#242723] text-left text-xs text-[#F0E8D6] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Dna className="w-3.5 h-3.5 text-[#C8A45D]" />
                  <span>02. Sound DNA Laboratory & Recorder</span>
                </div>
                <span className="text-[10px] text-[#96988E]">LAB</span>
              </button>

              <button
                onClick={() => {
                  playHapticSound('click');
                  setActiveTab('compare');
                  setIsCommandOpen(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-[2px] hover:bg-[#242723] text-left text-xs text-[#F0E8D6] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <GitCompare className="w-3.5 h-3.5 text-[#C8A45D]" />
                  <span>03. Comparative Analysis Bench</span>
                </div>
                <span className="text-[10px] text-[#96988E]">BENCH</span>
              </button>

              <div className="text-[10px] text-[#96988E] uppercase px-3 py-1 pt-3">
                MATCHING ARCHIVE SPECIMENS
              </div>

              {allExhibits
                .filter(
                  (e) =>
                    commandQuery === '' ||
                    e.title.toLowerCase().includes(commandQuery.toLowerCase()) ||
                    e.category.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .slice(0, 6)
                .map((exhibit) => (
                  <button
                    key={exhibit.id}
                    onClick={() => {
                      playHapticSound('click');
                      handleSelectForDna(exhibit);
                      setIsCommandOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-[2px] hover:bg-[#242723] text-left text-xs text-[#F0E8D6] transition-colors"
                  >
                    <div className="flex items-center gap-2 line-clamp-1">
                      <span className="text-[#96988E] text-[10px]">[{exhibit.year}]</span>
                      <span className="font-normal">{exhibit.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#96988E]" />
                  </button>
                ))}
            </div>

            <div className="p-2.5 bg-[#151614] border-t border-[#2A2D28] flex items-center justify-between text-[10px] text-[#96988E] font-mono">
              <span>SELECT ITEM TO ACCESS RECORD</span>
              <span>ESC TO EXIT</span>
            </div>
          </div>
        </div>
      )}

      {/* Editorial Colophon / Footer */}
      <footer className="border-t border-[#2A2D28] bg-[#111210] py-6 px-4 lg:px-8 mt-12 text-[#96988E] text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-[2px] bg-[#1C1E1B] border border-[#2A2D28] flex items-center justify-center text-[#C8A45D] font-mono text-[10px]">
              SP
            </div>
            <div>
              <span className="font-medium text-[#F0E8D6]">SOUNDPRINT ARCHIVE</span>
              <span className="mx-2">•</span>
              <span>National Conservancy of Vanishing Everyday Acoustics</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px]">
            <span>100% WEB AUDIO API</span>
            <span>•</span>
            <span>NO EXTERNAL CDNS</span>
            <span>•</span>
            <span>ZERO CLOUD TELEMETRY</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
