/**
 * Real audio capture, playback and synthesis utilities
 */

// Web Audio API Synthesizer for notifications and emergency alarms
class SoundSystem {
  private ctx: AudioContext | null = null;
  private alarmOsc1: OscillatorNode | null = null;
  private alarmOsc2: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private alarmInterval: any = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play pleasant notification chime
  public playChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Play distinctive SOS / Emergency Siren
  public startEmergencySiren() {
    try {
      if (this.alarmInterval) return;
      const ctx = this.getContext();
      const now = ctx.currentTime;

      this.alarmGain = ctx.createGain();
      this.alarmGain.gain.setValueAtTime(0.3, now);
      this.alarmGain.connect(ctx.destination);

      let toggle = false;
      const playTone = () => {
        if (!this.ctx || !this.alarmGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(toggle ? 900 : 650, t);
        osc.connect(this.alarmGain);
        osc.start(t);
        osc.stop(t + 0.28);
        toggle = !toggle;
      };

      playTone();
      this.alarmInterval = setInterval(playTone, 320);
    } catch (e) {
      console.warn('Alarm audio error:', e);
    }
  }

  public stopEmergencySiren() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.alarmGain) {
      try {
        this.alarmGain.disconnect();
      } catch {}
      this.alarmGain = null;
    }
  }
}

export const sound = new SoundSystem();

// Real Voice Recorder using MediaRecorder
export interface VoiceRecordingResult {
  blob: Blob;
  dataUrl: string;
  durationSeconds: number;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  public async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Set up Web Audio AnalyserNode for live visualizer
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);
    } catch (e) {
      console.warn('AudioContext visualizer setup note:', e);
    }

    // Determine supported mime type
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = '';
      }
    }

    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(100);
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public stop(): Promise<VoiceRecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not active'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });

        // Clean up visualizer nodes
        if (this.sourceNode) {
          try { this.sourceNode.disconnect(); } catch {}
          this.sourceNode = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
          try { this.audioContext.close(); } catch {}
          this.audioContext = null;
        }
        this.analyser = null;

        // Stop stream tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            blob,
            dataUrl: reader.result as string,
            durationSeconds,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
  }
}
