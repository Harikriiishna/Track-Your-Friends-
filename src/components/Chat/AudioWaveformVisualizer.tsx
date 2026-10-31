import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/audio.ts';

interface AudioWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  height?: number;
  barColor?: string;
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  analyser,
  height = 36,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = 15 + Math.sin(Date.now() / 200 + i * 0.5) * 10;
        }
      }

      const barCount = 28;
      const barWidth = Math.floor(width / barCount) - 2;
      const step = Math.floor(dataArray.length / barCount) || 1;

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] || 0;
        const percent = val / 255;
        const barHeight = Math.max(4, Math.floor(percent * (h - 6)));
        const x = i * (barWidth + 2);
        const y = Math.floor((h - barHeight) / 2);

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#2563eb');

        ctx.fillStyle = grad;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, 2);
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={height}
      className="w-full max-w-[240px] h-[36px] block rounded-md"
    />
  );
};

interface VoiceMessagePlayerProps {
  src: string;
  initialDuration?: number;
  compact?: boolean;
  isSelf?: boolean;
}

const BAR_COUNT = 36;

// Generate deterministic natural-looking voice waveform envelope as initial/fallback peaks
function generateFallbackPeaks(seedStr: string, count: number): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    hash ^= i * 37;
    hash = Math.imul(hash, 16777619);
    const pseudo = ((hash >>> 0) % 1000) / 1000;
    const envelope = Math.sin((i / (count - 1)) * Math.PI);
    const val = 0.22 + (0.35 * pseudo + 0.43 * Math.abs(Math.sin(i * 0.65))) * (0.45 + 0.55 * envelope);
    peaks.push(Math.min(1, Math.max(0.16, val)));
  }
  return peaks;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  src,
  initialDuration = 0,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef< boolean >(false);
  const rafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(initialDuration > 0 ? initialDuration : 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [peaks, setPeaks] = useState<number[]>(() => generateFallbackPeaks(src || 'voice', BAR_COUNT));
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  // Decode actual audio buffer peaks from recorded voice note
  useEffect(() => {
    let cancelled = false;
    setPeaks(generateFallbackPeaks(src || 'voice', BAR_COUNT));

    async function decodeAudioPeaks() {
      if (!src) return;
      try {
        const res = await fetch(src);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const tempCtx = new AudioCtx();
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        if (cancelled) {
          tempCtx.close().catch(() => {});
          return;
        }

        if (audioBuffer.duration && Number.isFinite(audioBuffer.duration)) {
          setDuration(audioBuffer.duration);
        }

        const rawData = audioBuffer.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(rawData.length / BAR_COUNT));
        const extracted: number[] = [];
        let maxPeak = 0.01;

        for (let i = 0; i < BAR_COUNT; i++) {
          const start = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize && start + j < rawData.length; j++) {
            const sample = Math.abs(rawData[start + j]);
            if (sample > sum) sum = sample;
          }
          extracted.push(sum);
          if (sum > maxPeak) maxPeak = sum;
        }

        const normalized = extracted.map((v) => Math.max(0.16, Math.min(1, v / maxPeak)));
        if (!cancelled) {
          setPeaks(normalized);
        }
        tempCtx.close().catch(() => {});
      } catch {
        // Fallback peaks remain active if fetch/decode fails
      }
    }

    decodeAudioPeaks();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Connect Web Audio AnalyserNode to the HTMLAudioElement for live frequency response during playback
  const ensureAudioAnalyser = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl || sourceConnectedRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;

      const source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceConnectedRef.current = true;
    } catch {
      // Fallback to time-based dynamic synthesis if MediaElementSource cannot attach
    }
  }, []);

  // Draw dynamic waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqData = new Uint8Array(64);

    const draw = () => {
      const audioEl = audioRef.current;
      const liveTime = audioEl && !audioEl.paused ? audioEl.currentTime : currentTime;
      const totalDur = duration > 0 ? duration : audioEl?.duration || 1;
      const progress = Math.min(1, Math.max(0, totalDur > 0 ? liveTime / totalDur : 0));

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const hasLiveAnalyser = isPlaying && analyserRef.current;
      if (hasLiveAnalyser && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(freqData);
      }

      const totalBars = peaks.length;
      const gap = 2.5;
      const barWidth = Math.max(2.5, (width - (totalBars - 1) * gap) / totalBars);
      const now = performance.now();

      for (let i = 0; i < totalBars; i++) {
        const barRatio = i / totalBars;
        const isPlayed = barRatio <= progress;
        const isHover = hoverRatio !== null && barRatio <= hoverRatio;
        const basePeak = peaks[i] ?? 0.3;

        // Calculate dynamic modulation when playing
        let dynamicBoost = 1;
        if (isPlaying) {
          if (hasLiveAnalyser) {
            const binIdx = Math.min(freqData.length - 1, Math.floor((i / totalBars) * (freqData.length * 0.75)));
            const freqVal = freqData[binIdx] / 255;
            const distFromPlayhead = Math.abs(barRatio - progress);
            const playheadWeight = Math.max(0.35, 1 - distFromPlayhead * 1.6);
            dynamicBoost = 0.72 + freqVal * 0.65 * playheadWeight;
          } else {
            const wave = Math.sin(now / 110 + i * 0.55) * 0.22 + Math.cos(now / 170 - i * 0.3) * 0.12;
            dynamicBoost = 0.88 + wave;
          }
        }

        const effectiveRatio = Math.min(1, Math.max(0.15, basePeak * dynamicBoost));
        const barHeight = Math.max(4, effectiveRatio * (height - 6));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        if (isPlayed) {
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(0.5, '#06b6d4');
          grad.addColorStop(1, '#6366f1');
          ctx.fillStyle = grad;
        } else if (isHover) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.48)';
        } else {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.32)';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, Math.min(barWidth / 2, 3));
        ctx.fill();
      }

      // Draw glowing playhead pill when playing or partially scrubbed
      if (progress > 0 && progress < 1) {
        const playheadX = Math.min(width - 2, Math.max(2, progress * width));
        ctx.save();
        ctx.fillStyle = '#7dd3fc';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = isPlaying ? 8 : 4;
        ctx.beginPath();
        ctx.arc(playheadX, height / 2, isPlaying ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (isPlaying) {
        if (audioEl) {
          setCurrentTime(audioEl.currentTime);
        }
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, currentTime, duration, peaks, hoverRatio]);

  // Clean up AudioContext on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const togglePlay = async () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    triggerHaptic('light');
    ensureAudioAnalyser();

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume().catch(() => {});
    }

    if (audioEl.paused) {
      try {
        await audioEl.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Voice note playback error:', err);
      }
    } else {
      audioEl.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audioEl = audioRef.current;
    if (!canvas || !audioEl) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = rect.width > 0 ? clickX / rect.width : 0;
    const targetDuration = duration > 0 ? duration : audioEl.duration || 0;

    if (targetDuration > 0 && Number.isFinite(targetDuration)) {
      const nextTime = ratio * targetDuration;
      audioEl.currentTime = nextTime;
      setCurrentTime(nextTime);
      triggerHaptic('selection');
    }
  };

  const cyclePlaybackRate = () => {
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
    triggerHaptic('selection');
  };

  const displayDuration = duration > 0 ? duration : initialDuration;

  return (
    <div
      className={`group/voice flex items-center gap-2.5 ${
        compact ? 'px-2.5 py-1.5 max-w-xs' : 'p-2.5 max-w-sm'
      } rounded-2xl bg-slate-900/75 border border-white/10 hover:border-cyan-500/35 shadow-md backdrop-blur-xl transition-all`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && Number.isFinite(d)) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="hidden"
      />

      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
          isPlaying
            ? 'bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/30'
            : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform Visualizer + Meta Row */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <canvas
          ref={canvasRef}
          width={200}
          height={compact ? 24 : 30}
          onClick={handleSeek}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width > 0) {
              setHoverRatio(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
            }
          }}
          onMouseLeave={() => setHoverRatio(null)}
          title="Click to seek audio"
          className={`w-full ${compact ? 'h-6' : 'h-[30px]'} block cursor-pointer`}
        />

        <div className="flex items-center justify-between text-[10px] leading-none">
          <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-300">
            <span className={isPlaying ? 'text-cyan-300 font-semibold' : 'text-slate-400'}>
              {formatAudioTime(isPlaying || currentTime > 0 ? currentTime : 0)}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{formatAudioTime(displayDuration)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isPlaying && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400 animate-pulse">
                <Volume2 className="w-2.5 h-2.5" />
                Live
              </span>
            )}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              title="Toggle playback speed"
              className="px-1.5 py-0.5 rounded-md bg-white/5 hover:bg-white/15 text-[9px] font-mono font-bold text-cyan-300 border border-white/10 transition-colors cursor-pointer"
            >
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
