import type { PlayerActionType } from "../types/poker";

export type TableSoundName = "deal-card" | "chip-bet" | "chips-to-pot" | "card-flip" | "fold" | "win-pot";

const SOUND_FREQUENCIES: Record<TableSoundName, number> = {
  "deal-card": 260,
  "chip-bet": 360,
  "chips-to-pot": 420,
  "card-flip": 300,
  fold: 190,
  "win-pot": 520,
};

export function playSound(enabled: boolean, name: TableSoundName): void {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = name === "win-pot" ? "triangle" : "sine";
    oscillator.frequency.value = SOUND_FREQUENCIES[name];
    gain.gain.setValueAtTime(0.028, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.085);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.095);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch {
    // 浏览器不支持或禁止音频时静默退化，不影响牌局。
  }
}

export function playActionSound(enabled: boolean, action: PlayerActionType): void {
  playSound(enabled, action === "fold" ? "fold" : action === "all-in" ? "win-pot" : "chip-bet");
}
