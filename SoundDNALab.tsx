import React, { useRef, useState, useEffect } from 'react';
import {
  Mic, Square, Upload, Play, Pause, Download, Dna,
  Save, Volume2, Activity, Radio, FileText, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  SoundExhibit, AudioAnalysis, SoundDNA, DnaVisualMode, DnaColorScheme,
  SoundCategory, ExtinctionStatus
} from './types';
import { SoundDnaRenderer } from './dnaRenderer';
import {
  getAudioContext, analyzeAudioBuffer, generateSoundDNA,
  SoundMuseumPlayer, playHapticSound
} from './audioEngine';

interface SoundDNALabProps {
  initialExhibit?: SoundExhibit | null;
  onArchiveNewSound: (exhibit: SoundExhibit) => void;
  onClose?: () => void;
}

export const SoundDNALab: React.FC<SoundDNALabProps> = ({
  initialExhibit,
  onArchiveNewSound,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SoundDnaRenderer | null>(null);
  const player = SoundMuseumPlayer.getInstance();

  // Mode: either inspecting existing or creating new
  const [activeExhibit, setActiveExhibit] = useState<SoundExhibit | null>(initialExhibit || null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBuffer, setActiveBuffer] = useState<AudioBuffer | null>(null);

  // DNA Customization parameters
  const [dnaStyle, setDnaStyle] = useState<DnaVisualMode>(initialExhibit?.dna.style || 'bloom');
  const [colorScheme, setColorScheme] = useState<DnaColorScheme>(initialExhibit?.dna.colorScheme || 'amber-cyan');
  const [petalCount, setPetalCount] = useState<number>(initialExhibit?.dna.petalCount || 8);
  const [complexity, setComplexity] = useState<number>(initialExhibit?.dna.complexity || 6);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(initialExhibit?.dna.orbitSpeed || 1.0);

  // Metadata form for archiving newly recorded or uploaded sounds
  const [formTitle, setFormTitle] = useState('');
  const [formYear, setFormYear] = useState(1995);
  const [formEra, setFormEra] = useState('1990s');
  const [formCategory, setFormCategory] = useState<SoundCategory>('mechanical');
  const [formStatus, setFormStatus] = useState<ExtinctionStatus>('critically_endangered');
  const [formLocation, setFormLocation] = useState('Local Archive');
  const [formHistory, setFormHistory] = useState('');
  const [formAcoustic, setFormAcoustic] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Load audio buffer when activeExhibit changes
  useEffect(() => {
    let isMounted = true;

    async function loadAudio() {
      if (!activeExhibit) return;
      try {
        let buffer: AudioBuffer;
        if (activeExhibit.audioPresetId) {
          buffer = await player.getAudioBufferForPreset(activeExhibit.audioPresetId);
        } else if (activeExhibit.audioUrl) {
          const resp = await fetch(activeExhibit.audioUrl);
          const arrayBuf = await resp.arrayBuffer();
          buffer = await getAudioContext().decodeAudioData(arrayBuf);
        } else {
          return;
        }
        if (isMounted) setActiveBuffer(buffer);
      } catch (err) {
        console.error('Error loading exhibit audio:', err);
      }
    }

    loadAudio();
    return () => {
      isMounted = false;
      player.stop();
    };
  }, [activeExhibit]);

  // Sync listener with global player
  useEffect(() => {
    const unsub = player.setListener((playing) => {
      setIsPlaying(playing);
    });
    return () => unsub();
  }, [player]);

  // Update DNA states when initialExhibit changes
  useEffect(() => {
    if (initialExhibit) {
      setActiveExhibit(initialExhibit);
      setDnaStyle(initialExhibit.dna.style);
      setColorScheme(initialExhibit.dna.colorScheme);
      setPetalCount(initialExhibit.dna.petalCount);
      setComplexity(initialExhibit.dna.complexity);
      setOrbitSpeed(initialExhibit.dna.orbitSpeed);
      setIsSaved(true);
    }
  }, [initialExhibit]);

  // Active SoundDNA object reflecting controls
  const currentDna: SoundDNA = {
    seed: activeExhibit?.dna.seed || 12345,
    primaryHue: activeExhibit?.dna.primaryHue || 190,
    secondaryHue: activeExhibit?.dna.secondaryHue || 330,
    complexity,
    resonanceRings: activeExhibit?.dna.resonanceRings || 6,
    petalCount,
    orbitSpeed,
    particleDensity: activeExhibit?.dna.particleDensity || 100,
    style: dnaStyle,
    colorScheme
  };

  // Setup Canvas Renderer and live animation loop
  useEffect(() => {
    if (!canvasRef.current) return;

    if (!rendererRef.current) {
      rendererRef.current = new SoundDnaRenderer(canvasRef.current);
    }

    const renderer = rendererRef.current;
    const dummyAnalysis: AudioAnalysis = activeExhibit?.analysis || {
      spectralCentroid: 2000,
      zeroCrossingRate: 0.45,
      energyRMS: 0.6,
      dynamicRange: 24,
      harmonicity: 0.55,
      dominantFrequency: 800,
      spectralRoughness: 0.5,
      waveformPoints: new Array(30).fill(0.3),
      frequencyBands: new Array(32).fill(0.4)
    };

    renderer.startAnimation(
      currentDna,
      dummyAnalysis,
      () => player.getAnalyser(),
      () => isPlaying
    );

    return () => {
      renderer.destroy();
    };
  }, [currentDna, activeExhibit, isPlaying]);

  // Handle Play/Pause
  const togglePlay = async () => {
    if (!activeBuffer) return;
    if (isPlaying) {
      player.stop();
    } else {
      await player.play(activeExhibit?.id || 'lab-audio', activeBuffer);
    }
  };

  // Start Live Microphone Recording
  const startRecording = async () => {
    try {
      playHapticSound('click');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const decodedBuffer = await getAudioContext().decodeAudioData(arrayBuffer);

        const analysis = analyzeAudioBuffer(decodedBuffer);
        const dna = generateSoundDNA(analysis, dnaStyle, colorScheme);

        const blobUrl = URL.createObjectURL(audioBlob);

        const newExhibit: SoundExhibit = {
          id: 'custom-' + Date.now(),
          title: formTitle || 'Field Recording ' + new Date().toLocaleTimeString(),
          category: formCategory,
          era: formEra,
          year: formYear,
          extinctionStatus: formStatus,
          recordedLocation: formLocation,
          historicalContext: formHistory || 'Acoustic field specimen recorded via live transducer input.',
          acousticDescription: `Dominant frequency: ${analysis.dominantFrequency}Hz, Spectral centroid: ${analysis.spectralCentroid}Hz.`,
          audioUrl: blobUrl,
          duration: parseFloat(decodedBuffer.duration.toFixed(1)),
          analysis,
          dna,
          tags: ['Field Recording', 'Preserved Specimen', 'Acoustic Archive'],
          isCustom: true,
          createdAt: new Date().toISOString()
        };

        setActiveExhibit(newExhibit);
        setActiveBuffer(decodedBuffer);
        setPetalCount(dna.petalCount);
        setComplexity(dna.complexity);
        setIsSaved(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      alert('Microphone input access required for acoustic recording.');
    }
  };

  // Stop Microphone Recording
  const stopRecording = () => {
    playHapticSound('confirm');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      playHapticSound('confirm');
      const decodedBuffer = await player.decodeAudioFile(file);
      const analysis = analyzeAudioBuffer(decodedBuffer);
      const dna = generateSoundDNA(analysis, dnaStyle, colorScheme);
      const blobUrl = URL.createObjectURL(file);

      const newExhibit: SoundExhibit = {
        id: 'upload-' + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        category: formCategory,
        era: formEra,
        year: formYear,
        extinctionStatus: formStatus,
        recordedLocation: formLocation,
        historicalContext: 'Uploaded acoustic artifact specimen.',
        acousticDescription: `Analyzed from audio file: ${file.name}. Duration: ${decodedBuffer.duration.toFixed(1)}s`,
        audioUrl: blobUrl,
        duration: parseFloat(decodedBuffer.duration.toFixed(1)),
        analysis,
        dna,
        tags: ['Audio Upload', 'Archival Document'],
        isCustom: true,
        createdAt: new Date().toISOString()
      };

      setActiveExhibit(newExhibit);
      setActiveBuffer(decodedBuffer);
      setFormTitle(newExhibit.title);
      setPetalCount(dna.petalCount);
      setComplexity(dna.complexity);
      setIsSaved(false);
    } catch {
      alert('Unable to decode this audio document. Please upload an uncompressed WAV, MP3, or OGG file.');
    }
  };

  // Archive & Save to Museum
  const handleArchive = () => {
    if (!activeExhibit) return;
    playHapticSound('confirm');

    const updatedExhibit: SoundExhibit = {
      ...activeExhibit,
      title: formTitle || activeExhibit.title,
      year: formYear,
      era: formEra,
      category: formCategory,
      extinctionStatus: formStatus,
      recordedLocation: formLocation,
      historicalContext: formHistory || activeExhibit.historicalContext,
      acousticDescription: formAcoustic || activeExhibit.acousticDescription,
      dna: currentDna
    };

    onArchiveNewSound(updatedExhibit);
    setIsSaved(true);

    // Subtle archival confetti in restrained museum tones
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#C8A45D', '#A5BC94', '#F0E8D6', '#96988E']
    });
  };

  // Download Sound DNA Specimen PNG
  const downloadDnaBadge = () => {
    if (!rendererRef.current) return;
    playHapticSound('click');
    const dataUrl = rendererRef.current.exportAsPng();
    const link = document.createElement('a');
    link.download = `SoundDNA-${activeExhibit?.title || 'Specimen'}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Laboratory Instrument Console Header */}
      <div className="bg-[#1C1E1B] border border-[#2A2D28] rounded-[2px] p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#C8A45D] text-[10px] font-mono tracking-widest uppercase mb-1">
              <Dna className="w-3.5 h-3.5" />
              <span>LABORATORY BENCH // SOUND DNA SYNTHESIS</span>
            </div>
            <h2 className="text-2xl font-medium font-display text-[#F0E8D6]">
              {activeExhibit ? activeExhibit.title : 'Acoustic Genetic Fingerprint'}
            </h2>
            <p className="text-xs text-[#96988E] mt-1 max-w-2xl font-mono">
              Extracts spectral centroid, zero-crossing rates, dynamic envelope, and harmonicity to generate a deterministic polar Sound DNA matrix.
            </p>
          </div>

          {/* Precision Capture Controls */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="bg-[#151614] hover:bg-[#20221F] text-[#D97757] border border-[#D97757]/40 py-1.5 px-3 rounded-[2px] flex items-center gap-2 transition-all active:scale-98"
              >
                <Mic className="w-3.5 h-3.5 text-[#D97757]" />
                <span>RECORD SENSOR</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="bg-[#D97757] text-[#111210] border border-[#D97757] py-1.5 px-3 rounded-[2px] font-medium flex items-center gap-2 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>HALT ({recordingSeconds}S)</span>
              </button>
            )}

            <label className="cursor-pointer bg-[#151614] hover:bg-[#20221F] text-[#F0E8D6] border border-[#2A2D28] hover:border-[#C8A45D]/40 py-1.5 px-3 rounded-[2px] flex items-center gap-2 transition-all active:scale-98">
              <Upload className="w-3.5 h-3.5 text-[#C8A45D]" />
              <span>INGEST AUDIO FILE</span>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Laboratory Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Polar Oscilloscope & Synthesis Parameters (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#1C1E1B] border border-[#2A2D28] rounded-[2px] p-6 relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2A2D28]">
              <div className="flex items-center gap-2 text-xs font-mono text-[#F0E8D6]">
                <Activity className="w-3.5 h-3.5 text-[#C8A45D]" />
                <span className="uppercase tracking-wider">POLAR OSCILLOSCOPE MONITOR</span>
              </div>
              <button
                onClick={downloadDnaBadge}
                className="text-[11px] font-mono bg-[#151614] hover:bg-[#20221F] text-[#96988E] hover:text-[#F0E8D6] border border-[#2A2D28] hover:border-[#C8A45D]/40 py-1 px-2.5 rounded-[2px] flex items-center gap-1.5 transition-all"
                title="Export high-resolution archival PNG"
              >
                <Download className="w-3 h-3 text-[#C8A45D]" />
                <span>EXPORT SPECIMEN PNG</span>
              </button>
            </div>

            {/* Polar Reticle Canvas Container */}
            <div className="relative rounded-[2px] overflow-hidden bg-[#151614] border border-[#2A2D28] flex items-center justify-center p-4 aspect-square max-h-[440px] mx-auto">
              {/* Scientific Crosshairs */}
              <span className="absolute top-2 left-2.5 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>
              <span className="absolute top-2 right-2.5 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>
              <span className="absolute bottom-2 left-2.5 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>
              <span className="absolute bottom-2 right-2.5 text-[9px] font-mono text-[#2A2D28] select-none pointer-events-none">+</span>

              <canvas
                ref={canvasRef}
                width={520}
                height={520}
                className="w-full h-full object-contain cursor-crosshair opacity-95"
              />

              {/* Transport Control Overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1C1E1B]/95 border border-[#2A2D28] px-3.5 py-1.5 rounded-[2px] shadow-lg">
                <button
                  onClick={togglePlay}
                  className="w-7 h-7 rounded-[2px] bg-[#C8A45D] hover:bg-[#b8934b] text-[#111210] flex items-center justify-center transition-transform active:scale-95"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
                <div className="text-[11px] font-mono text-[#F0E8D6] flex items-center gap-2">
                  <Volume2 className="w-3 h-3 text-[#C8A45D]" />
                  <span>{isPlaying ? 'ACTIVE FREQUENCY SWEEP' : 'SIGNAL IDLE'}</span>
                </div>
              </div>
            </div>

            {/* Synthesis Architecture Selectors */}
            <div className="mt-6 pt-4 border-t border-[#2A2D28] space-y-4">
              <div>
                <label className="text-[10px] font-mono text-[#96988E] uppercase tracking-wider block mb-2">
                  GEOMETRIC SYNTHESIS ALGORITHM
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                  {(
                    [
                      { id: 'bloom', label: 'Harmonic Bloom', desc: 'Phyllotaxis Matrix' },
                      { id: 'mandala', label: 'Spectral Mandala', desc: 'Resonance Rings' },
                      { id: 'waveform', label: 'Lissajous Loop', desc: 'Phase Trajectory' },
                      { id: 'constellation', label: 'Constellation', desc: 'Acoustic Mesh' }
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        playHapticSound('toggle');
                        setDnaStyle(mode.id);
                      }}
                      className={`p-2 rounded-[2px] border text-left transition-all ${
                        dnaStyle === mode.id
                          ? 'bg-[#2A2D28] border-[#C8A45D] text-[#F0E8D6]'
                          : 'bg-[#151614] border-[#2A2D28] text-[#96988E] hover:text-[#F0E8D6] hover:bg-[#20221F]'
                      }`}
                    >
                      <div className="text-xs font-medium">{mode.label}</div>
                      <div className="text-[9px] text-[#96988E] mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chromatic Palette */}
              <div>
                <label className="text-[10px] font-mono text-[#96988E] uppercase tracking-wider block mb-2">
                  ARCHIVAL CHROMATIC CALIBRATION
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                  {(
                    [
                      { id: 'amber-cyan', label: 'Amber & Sage', color: '#C8A45D' },
                      { id: 'cyberpunk', label: 'Umber & Gold', color: '#96988E' },
                      { id: 'solar-flare', label: 'Copper Brass', color: '#B87333' },
                      { id: 'monochrome', label: 'Archival Slate', color: '#F0E8D6' }
                    ] as const
                  ).map((palette) => (
                    <button
                      key={palette.id}
                      onClick={() => {
                        playHapticSound('toggle');
                        setColorScheme(palette.id);
                      }}
                      className={`p-2 rounded-[2px] border flex items-center gap-2 transition-all ${
                        colorScheme === palette.id
                          ? 'bg-[#2A2D28] border-[#C8A45D] text-[#F0E8D6]'
                          : 'bg-[#151614] border-[#2A2D28] text-[#96988E] hover:text-[#F0E8D6] hover:bg-[#20221F]'
                      }`}
                    >
                      <div className="w-2.5 h-2.5 rounded-[1px]" style={{ backgroundColor: palette.color }} />
                      <span className="text-xs">{palette.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mathematical Tuning Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-mono text-[#96988E] mb-1">
                    <span>PETAL NODES</span>
                    <span className="text-[#C8A45D]">{petalCount}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={18}
                    value={petalCount}
                    onChange={(e) => setPetalCount(Number(e.target.value))}
                    className="w-full accent-[#C8A45D] bg-[#2A2D28] h-1 rounded-none appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-[#96988E] mb-1">
                    <span>COMPLEXITY</span>
                    <span className="text-[#C8A45D]">{complexity}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    value={complexity}
                    onChange={(e) => setComplexity(Number(e.target.value))}
                    className="w-full accent-[#C8A45D] bg-[#2A2D28] h-1 rounded-none appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-[#96988E] mb-1">
                    <span>ORBIT VELOCITY</span>
                    <span className="text-[#C8A45D]">{orbitSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.5}
                    step={0.1}
                    value={orbitSpeed}
                    onChange={(e) => setOrbitSpeed(Number(e.target.value))}
                    className="w-full accent-[#C8A45D] bg-[#2A2D28] h-1 rounded-none appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: FFT Telemetry & Museum Registry Entry (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Engineering Acoustic Telemetry */}
          <div className="bg-[#1C1E1B] border border-[#2A2D28] rounded-[2px] p-6 space-y-4">
            <h3 className="text-xs font-mono text-[#F0E8D6] tracking-wider uppercase flex items-center gap-2 pb-2 border-b border-[#2A2D28]">
              <Radio className="w-3.5 h-3.5 text-[#C8A45D]" />
              <span>FFT SPECTRAL MEASUREMENT METRICS</span>
            </h3>

            {/* 32-Band Equalizer */}
            <div className="p-3 bg-[#151614] rounded-[2px] border border-[#2A2D28] space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-[#96988E]">
                <span>20 HZ</span>
                <span className="uppercase">32-BIN SPECTRAL ENVELOPE</span>
                <span>20 KHZ</span>
              </div>
              <div className="flex items-end gap-1 h-14 w-full px-1">
                {(activeExhibit?.analysis.frequencyBands || new Array(32).fill(0.3)).map((val, idx) => (
                  <div
                    key={idx}
                    style={{
                      height: `${Math.max(8, val * 100)}%`,
                      backgroundColor: idx % 2 === 0 ? '#C8A45D' : '#A5BC94'
                    }}
                    className="flex-1 rounded-[1px] opacity-80"
                  />
                ))}
              </div>
            </div>

            {/* Metrics Readout Table */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-[#151614] border border-[#2A2D28] rounded-[2px]">
                <span className="text-[#96988E] text-[10px] uppercase block">SPECTRAL CENTROID</span>
                <span className="text-[#F0E8D6] text-sm font-medium mt-0.5 block">
                  {activeExhibit?.analysis.spectralCentroid || 2450} <span className="text-xs text-[#96988E]">Hz</span>
                </span>
                <p className="text-[10px] text-[#96988E]/70 mt-1 leading-snug">Timbral acoustic brightness center.</p>
              </div>

              <div className="p-2.5 bg-[#151614] border border-[#2A2D28] rounded-[2px]">
                <span className="text-[#96988E] text-[10px] uppercase block">ZERO-CROSSING RATE</span>
                <span className="text-[#F0E8D6] text-sm font-medium mt-0.5 block">
                  {Math.round((activeExhibit?.analysis.zeroCrossingRate || 0.45) * 100)} <span className="text-xs text-[#96988E]">%</span>
                </span>
                <p className="text-[10px] text-[#96988E]/70 mt-1 leading-snug">Mechanical friction and noisiness.</p>
              </div>

              <div className="p-2.5 bg-[#151614] border border-[#2A2D28] rounded-[2px]">
                <span className="text-[#96988E] text-[10px] uppercase block">DYNAMIC CREST</span>
                <span className="text-[#F0E8D6] text-sm font-medium mt-0.5 block">
                  {activeExhibit?.analysis.dynamicRange || 28} <span className="text-xs text-[#96988E]">dB</span>
                </span>
                <p className="text-[10px] text-[#96988E]/70 mt-1 leading-snug">Peak-to-average contrast ratio.</p>
              </div>

              <div className="p-2.5 bg-[#151614] border border-[#2A2D28] rounded-[2px]">
                <span className="text-[#96988E] text-[10px] uppercase block">HARMONICITY</span>
                <span className="text-[#F0E8D6] text-sm font-medium mt-0.5 block">
                  {Math.round((activeExhibit?.analysis.harmonicity || 0.55) * 100)} <span className="text-xs text-[#96988E]">%</span>
                </span>
                <p className="text-[10px] text-[#96988E]/70 mt-1 leading-snug">Ratio of tonal pitch to noise.</p>
              </div>
            </div>
          </div>

          {/* Archival Accession Form */}
          <div className="bg-[#1C1E1B] border border-[#2A2D28] rounded-[2px] p-6 space-y-4 font-mono text-xs">
            <h3 className="text-xs text-[#F0E8D6] tracking-wider uppercase flex items-center gap-2 pb-2 border-b border-[#2A2D28]">
              <FileText className="w-3.5 h-3.5 text-[#C8A45D]" />
              <span>SPECIMEN ACCESSION REGISTRY</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[#96988E] block mb-1 text-[11px]">SPECIMEN TITLE</label>
                <input
                  type="text"
                  value={formTitle || activeExhibit?.title || ''}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Western Electric 500 Rotary Telephone"
                  className="w-full bg-[#151614] border border-[#2A2D28] rounded-[2px] px-3 py-1.5 text-[#F0E8D6] focus:outline-none focus:border-[#C8A45D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#96988E] block mb-1 text-[11px]">TAXONOMY</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as SoundCategory)}
                    className="w-full bg-[#151614] border border-[#2A2D28] rounded-[2px] px-2.5 py-1.5 text-[#F0E8D6] focus:outline-none focus:border-[#C8A45D]"
                  >
                    <option value="mechanical">Mechanical</option>
                    <option value="telecom">Telecommunication</option>
                    <option value="computing">Computing</option>
                    <option value="domestic">Domestic</option>
                    <option value="transport">Transport</option>
                    <option value="media">Media / Audio</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#96988E] block mb-1 text-[11px]">EXTINCTION RISK</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ExtinctionStatus)}
                    className="w-full bg-[#151614] border border-[#2A2D28] rounded-[2px] px-2.5 py-1.5 text-[#F0E8D6] focus:outline-none focus:border-[#C8A45D]"
                  >
                    <option value="vulnerable">Vulnerable</option>
                    <option value="endangered">Endangered</option>
                    <option value="critically_endangered">Critically Endangered</option>
                    <option value="extinct_in_daily_life">Extinct in Daily Life</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#96988E] block mb-1 text-[11px]">YEAR / ERA</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => {
                      const yr = Number(e.target.value);
                      setFormYear(yr);
                      setFormEra(`${Math.floor(yr / 10) * 10}s`);
                    }}
                    className="w-full bg-[#151614] border border-[#2A2D28] rounded-[2px] px-3 py-1.5 text-[#F0E8D6] focus:outline-none focus:border-[#C8A45D]"
                  />
                </div>

                <div>
                  <label className="text-[#96988E] block mb-1 text-[11px]">ORIGIN PROVENANCE</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Bell Laboratories, NJ"
                    className="w-full bg-[#151614] border border-[#2A2D28] rounded-[2px] px-3 py-1.5 text-[#F0E8D6] focus:outline-none focus:border-[#C8A45D]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#96988E] block mb-1 text-[11px]">CURATORIAL CONTEXT NOTE</label>
                <textarea
                  rows={2}
                  value={formHistory || activeExhibit?.historicalContext || ''}
                  onChange={(e) => setFormHistory(e.target.value)}
                  placeholder="Historical context, obsolete mechanism, everyday significance..."
                  className="w-full bg-[#151614] border border-[#2A2D28] rounded-[2px] px-3 py-1.5 text-[#F0E8D6] focus:outline-none focus:border-[#C8A45D] font-sans resize-none text-xs"
                />
              </div>

              <button
                onClick={handleArchive}
                className={`w-full py-2 px-4 rounded-[2px] border font-mono text-xs flex items-center justify-center gap-2 transition-all active:scale-98 ${
                  isSaved
                    ? 'bg-[#151614] text-[#A5BC94] border-[#A5BC94]'
                    : 'bg-[#C8A45D] hover:bg-[#b8934b] text-[#111210] border-[#C8A45D] font-medium'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ACCESSIONED TO PERMANENT ARCHIVE</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>RECORD TO MUSEUM COLLECTION</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
