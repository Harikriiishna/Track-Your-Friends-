import React, { useEffect, useRef } from 'react';

interface AudioWaveformVisualizerProps {
  analyser: AnalyserNode | null;
  height?: number;
  barColor?: string;
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  analyser,
  height = 36,
  barColor = '#38bdf8',
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
        // Subtle fallback animation
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
        // Minimum bar height 4px, maximum up to canvas height
        const barHeight = Math.max(4, Math.floor(percent * (h - 6)));
        const x = i * (barWidth + 2);
        const y = Math.floor((h - barHeight) / 2);

        // Gradient styling
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#2563eb');

        ctx.fillStyle = grad;
        // Rounded bar caps
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
