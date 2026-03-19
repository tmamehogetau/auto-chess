const CUE_LIBRARY = {
  confirm: [
    {
      waveform: "triangle",
      startFrequency: 520,
      endFrequency: 660,
      durationMs: 110,
      volume: 0.035,
      startAt: 0,
    },
  ],
  purchase: [
    {
      waveform: "square",
      startFrequency: 440,
      endFrequency: 620,
      durationMs: 90,
      volume: 0.03,
      startAt: 0,
    },
    {
      waveform: "triangle",
      startFrequency: 660,
      endFrequency: 780,
      durationMs: 110,
      volume: 0.02,
      startAt: 0.05,
    },
  ],
  "battle-start": [
    {
      waveform: "sawtooth",
      startFrequency: 180,
      endFrequency: 320,
      durationMs: 180,
      volume: 0.045,
      startAt: 0,
    },
    {
      waveform: "triangle",
      startFrequency: 320,
      endFrequency: 540,
      durationMs: 220,
      volume: 0.03,
      startAt: 0.05,
    },
  ],
  victory: [
    {
      waveform: "triangle",
      startFrequency: 480,
      endFrequency: 760,
      durationMs: 260,
      volume: 0.045,
      startAt: 0,
    },
  ],
  defeat: [
    {
      waveform: "sawtooth",
      startFrequency: 340,
      endFrequency: 180,
      durationMs: 280,
      volume: 0.04,
      startAt: 0,
    },
  ],
};

let audioContext = null;

export function buildCuePlan(kind) {
  return CUE_LIBRARY[kind] ? [...CUE_LIBRARY[kind]] : [];
}

function resolveAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  try {
    audioContext = new AudioContextCtor();
  } catch {
    audioContext = null;
  }

  return audioContext;
}

export function playUiCue(kind) {
  const cuePlan = buildCuePlan(kind);
  if (cuePlan.length === 0) {
    return false;
  }

  const context = resolveAudioContext();
  if (!context) {
    return false;
  }

  if (typeof context.resume === "function" && context.state === "suspended") {
    void context.resume().catch(() => {});
  }

  const baseTime = typeof context.currentTime === "number" ? context.currentTime : 0;

  for (const tone of cuePlan) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = baseTime + (Number(tone.startAt) || 0);
    const durationSeconds = Math.max(0.04, (Number(tone.durationMs) || 120) / 1000);
    const endAt = startAt + durationSeconds;
    const safeVolume = Math.max(0.001, Number(tone.volume) || 0.03);

    oscillator.type = tone.waveform || "triangle";
    oscillator.frequency.setValueAtTime(Number(tone.startFrequency) || 440, startAt);
    oscillator.frequency.linearRampToValueAtTime(Number(tone.endFrequency) || 440, endAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.linearRampToValueAtTime(safeVolume, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  return true;
}
