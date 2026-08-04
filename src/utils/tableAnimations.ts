import type { Card, GameSpeed, GameState, Player, PlayerAction } from "../types/poker";
import { CARD_BACK_ASSET, cardAssetPath, logCardAssetFailure } from "./cardAssets";

export interface TableMotionSettings {
  enabled: boolean;
  speed: GameSpeed;
}

type SoundName = "deal-card" | "chip-bet" | "chips-to-pot" | "card-flip" | "fold" | "win-pot";
type SoundPlayer = (name: SoundName) => void;

const activeAnimations = new Set<Animation>();
const transientElements = new Set<HTMLElement>();
let animationQueue: Promise<void> = Promise.resolve();

export function motionScale(settings: TableMotionSettings): number {
  if (!settings.enabled || settings.speed === "instant") return 0;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
  return settings.speed === "fast" ? 0.52 : 1;
}

export function enqueueTableAnimation(task: () => Promise<void>): Promise<void> {
  const run = animationQueue.then(task, task);
  animationQueue = run.catch((error) => console.error("牌桌动画已安全跳过", error));
  return run;
}

function duration(base: number, settings: TableMotionSettings): number {
  return Math.round(base * motionScale(settings));
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function trackedAnimate(element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted || Number(options.duration) <= 0) return Promise.resolve();
  const animation = element.animate(keyframes, options);
  activeAnimations.add(animation);
  const cancel = () => animation.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  return animation.finished.catch(() => undefined).then(() => {
    activeAnimations.delete(animation);
    signal?.removeEventListener("abort", cancel);
  });
}

function animationLayer(table: HTMLElement): HTMLElement {
  const layer = table.querySelector<HTMLElement>("[data-table-animation-layer]");
  if (!layer) throw new Error("缺少牌桌动画图层");
  return layer;
}

function center(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function relativeBox(table: HTMLElement, target: HTMLElement) {
  const layerRect = animationLayer(table).getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  return { left: rect.left - layerRect.left, top: rect.top - layerRect.top, width: rect.width, height: rect.height };
}

function trackElement<T extends HTMLElement>(element: T, layer: HTMLElement): T {
  transientElements.add(element);
  layer.appendChild(element);
  return element;
}

function removeTransient(element: HTMLElement): void {
  transientElements.delete(element);
  element.remove();
}

function cardElement(card?: Card, hidden = true, small = false): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `playing-card ${small ? "small " : ""}${hidden || !card ? "card-back" : "card-front"}`;
  const path = hidden || !card ? CARD_BACK_ASSET : cardAssetPath(card);
  const image = document.createElement("img");
  image.src = path;
  image.alt = "";
  image.draggable = false;
  image.addEventListener("error", () => {
    logCardAssetFailure(hidden ? undefined : card, path);
    const fallback = document.createElement("span");
    fallback.className = "card-artwork-fallback";
    const rank = document.createElement("strong");
    rank.textContent = hidden || !card ? "CARD" : card.rank;
    const suit = document.createElement("small");
    suit.textContent = hidden || !card ? "BACK" : card.suit.toUpperCase();
    fallback.append(rank, suit);
    image.replaceWith(fallback);
  }, { once: true });
  element.appendChild(image);
  if (card && !hidden) element.dataset.rank = card.rank;
  return element;
}

function chipStack(count: number, strong = false): HTMLDivElement {
  const stack = document.createElement("div");
  stack.className = `flying-chip-stack${strong ? " all-in-flight" : ""}`;
  for (let index = 0; index < count; index += 1) {
    const chip = document.createElement("i");
    chip.style.setProperty("--chip-index", String(index));
    stack.appendChild(chip);
  }
  return stack;
}

function chipCount(amount: number, bigBlind: number, allIn = false): number {
  if (allIn) return 5;
  const blinds = amount / Math.max(1, bigBlind);
  return blinds >= 12 ? 5 : blinds >= 5 ? 3 : blinds >= 2 ? 2 : 1;
}

async function flyElement(table: HTMLElement, element: HTMLElement, from: HTMLElement, to: HTMLElement, milliseconds: number, signal?: AbortSignal, rotation = 0): Promise<void> {
  const layer = animationLayer(table);
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const start = center(fromRect);
  const end = center(toRect);
  element.style.left = `${start.x - layerRect.left}px`;
  element.style.top = `${start.y - layerRect.top}px`;
  trackElement(element, layer);
  await trackedAnimate(element, [
    { transform: "translate(-50%, -50%) scale(.72) rotate(0deg)", opacity: 0.15, offset: 0 },
    { transform: `translate(calc(-50% + ${(end.x - start.x) * 0.56}px), calc(-50% + ${(end.y - start.y) * 0.42 - 20}px)) scale(1.04) rotate(${rotation * 0.6}deg)`, opacity: 1, offset: 0.62 },
    { transform: `translate(calc(-50% + ${end.x - start.x}px), calc(-50% + ${end.y - start.y}px)) scale(.94) rotate(${rotation}deg)`, opacity: 1, offset: 0.88 },
    { transform: `translate(calc(-50% + ${end.x - start.x}px), calc(-50% + ${end.y - start.y}px)) scale(1) rotate(${rotation}deg)`, opacity: 1, offset: 1 },
  ], { duration: milliseconds, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)", fill: "forwards" }, signal);
}

export async function animateDealCard({ table, target, card, reveal, settings, signal, persist = false }: {
  table: HTMLElement;
  target: HTMLElement;
  card?: Card;
  reveal: boolean;
  settings: TableMotionSettings;
  signal?: AbortSignal;
  persist?: boolean;
}): Promise<void> {
  const milliseconds = duration(410, settings);
  if (!milliseconds || signal?.aborted) return;
  const deck = table.querySelector<HTMLElement>("[data-card-deck]");
  if (!deck) return;
  const box = relativeBox(table, target);
  const flight = document.createElement("div");
  flight.className = "table-card-flight";
  flight.style.width = `${box.width}px`;
  flight.style.height = `${box.height}px`;
  const flipper = document.createElement("div");
  flipper.className = "table-card-flipper";
  const back = cardElement(undefined, true, target.classList.contains("small"));
  back.classList.add("animation-card-face", "animation-card-back");
  flipper.appendChild(back);
  if (reveal && card) {
    const front = cardElement(card, false, target.classList.contains("small"));
    front.classList.add("animation-card-face", "animation-card-front");
    flipper.appendChild(front);
  }
  flight.appendChild(flipper);
  await flyElement(table, flight, deck, target, milliseconds, signal, target.closest("[data-player-id]") ? (Math.random() * 10 - 5) : -2);
  if (reveal && card && !signal?.aborted) {
    await trackedAnimate(flipper, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], {
      duration: duration(230, settings), easing: "cubic-bezier(.42,0,.2,1)", fill: "forwards",
    }, signal);
  }
  target.classList.add("animation-revealed");
  if (!persist) removeTransient(flight);
}

export async function animateFlipCard({ table, target, card, settings, signal, persist = true }: {
  table: HTMLElement; target: HTMLElement; card: Card; settings: TableMotionSettings; signal?: AbortSignal; persist?: boolean;
}): Promise<void> {
  const milliseconds = duration(260, settings);
  if (!milliseconds || signal?.aborted) return;
  const box = relativeBox(table, target);
  const flight = document.createElement("div");
  flight.className = "table-card-flight settled-card";
  Object.assign(flight.style, { left: `${box.left + box.width / 2}px`, top: `${box.top + box.height / 2}px`, width: `${box.width}px`, height: `${box.height}px` });
  const flipper = document.createElement("div");
  flipper.className = "table-card-flipper";
  const back = target.cloneNode(true) as HTMLElement;
  back.classList.add("animation-card-face", "animation-card-back");
  const front = cardElement(card, false, target.classList.contains("small"));
  front.classList.add("animation-card-face", "animation-card-front");
  flipper.append(back, front);
  flight.appendChild(flipper);
  trackElement(flight, animationLayer(table));
  await trackedAnimate(flipper, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: milliseconds, easing: "cubic-bezier(.42,0,.2,1)", fill: "forwards" }, signal);
  target.classList.add("animation-concealed");
  if (!persist) removeTransient(flight);
}

export async function animatePlayerBet({ table, playerId, amount, bigBlind, allIn, settings, signal }: {
  table: HTMLElement; playerId: string; amount: number; bigBlind: number; allIn: boolean; settings: TableMotionSettings; signal?: AbortSignal;
}): Promise<void> {
  const milliseconds = duration(allIn ? 480 : 390, settings);
  if (!milliseconds || amount <= 0 || signal?.aborted) return;
  const from = table.querySelector<HTMLElement>(`[data-player-id="${playerId}"] [data-chip-count]`);
  const to = table.querySelector<HTMLElement>(`[data-player-bet="${playerId}"]`);
  if (!from || !to) return;
  const stack = chipStack(chipCount(amount, bigBlind, allIn), allIn);
  await flyElement(table, stack, from, to, milliseconds, signal, allIn ? 8 : 4);
  removeTransient(stack);
}

export async function animateBetsToPot({ table, contributions, bigBlind, settings, signal }: {
  table: HTMLElement; contributions: Array<{ playerId: string; amount: number }>; bigBlind: number; settings: TableMotionSettings; signal?: AbortSignal;
}): Promise<void> {
  const milliseconds = duration(430, settings);
  if (!milliseconds || signal?.aborted) return;
  const pot = table.querySelector<HTMLElement>("[data-pot]");
  if (!pot) return;
  const flights = contributions.filter(({ amount }) => amount > 0).map(async ({ playerId, amount }, index) => {
    const from = table.querySelector<HTMLElement>(`[data-player-bet="${playerId}"]`);
    if (!from) return;
    await wait(index * duration(28, settings), signal);
    const stack = chipStack(chipCount(amount, bigBlind));
    await flyElement(table, stack, from, pot, milliseconds, signal, index % 2 ? 8 : -8);
    removeTransient(stack);
  });
  await Promise.all(flights);
  await trackedAnimate(pot, [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: duration(180, settings), easing: "ease-out" }, signal);
}

export async function animatePotToWinner({ table, awards, bigBlind, settings, signal }: {
  table: HTMLElement; awards: NonNullable<GameState["result"]>["awards"]; bigBlind: number; settings: TableMotionSettings; signal?: AbortSignal;
}): Promise<void> {
  const milliseconds = duration(520, settings);
  if (!milliseconds || signal?.aborted) return;
  const pot = table.querySelector<HTMLElement>("[data-pot]");
  if (!pot) return;
  for (const award of awards) {
    await Promise.all(Object.entries(award.shares).map(async ([playerId, amount], index) => {
      const seat = table.querySelector<HTMLElement>(`[data-player-id="${playerId}"]`);
      if (!seat) return;
      await wait(index * duration(70, settings), signal);
      const stack = chipStack(chipCount(amount, bigBlind, amount >= award.amount * 0.8), true);
      await flyElement(table, stack, pot, seat, milliseconds, signal, index % 2 ? 10 : -10);
      removeTransient(stack);
      await trackedAnimate(seat, [{ filter: "brightness(1)" }, { filter: "brightness(1.28)" }, { filter: "brightness(1)" }], { duration: duration(260, settings), easing: "ease-out" }, signal);
    }));
  }
}

export async function animateFoldCards({ table, playerId, settings, signal }: {
  table: HTMLElement; playerId: string; settings: TableMotionSettings; signal?: AbortSignal;
}): Promise<void> {
  const milliseconds = duration(360, settings);
  if (!milliseconds || signal?.aborted) return;
  const discard = table.querySelector<HTMLElement>("[data-discard-pile]");
  const cards = [...table.querySelectorAll<HTMLElement>(`[data-player-id="${playerId}"] [data-hole-card]`)].filter((card) => !card.classList.contains("animation-concealed"));
  if (!discard || !cards.length) return;
  await Promise.all(cards.map(async (card, index) => {
    await wait(index * duration(55, settings), signal);
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add("folding-card");
    card.classList.add("animation-concealed");
    await flyElement(table, ghost, card, discard, milliseconds, signal, index ? 18 : -14);
    await trackedAnimate(ghost, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.72 }], { duration: duration(120, settings), fill: "forwards" }, signal);
    removeTransient(ghost);
  }));
}

function latestAction(previous: GameState, next: GameState): PlayerAction | undefined {
  return next.actions.length > previous.actions.length ? next.actions.at(-1) : undefined;
}

function streetContributions(previous: GameState, action?: PlayerAction): Array<{ playerId: string; amount: number }> {
  return previous.players.map((player) => ({
    playerId: player.id,
    amount: player.streetBet + (action?.playerId === player.id ? action.amount : 0),
  })).filter(({ amount }) => amount > 0);
}

export async function animateHandOpening({ table, game, settings, signal, playSound }: {
  table: HTMLElement; game: GameState; settings: TableMotionSettings; signal?: AbortSignal; playSound?: SoundPlayer;
}): Promise<void> {
  if (!motionScale(settings) || signal?.aborted) return;
  const blindPlayers = [game.smallBlindIndex, game.bigBlindIndex].map((index) => game.players[index]).filter(Boolean);
  for (const player of blindPlayers) {
    await animatePlayerBet({ table, playerId: player.id, amount: player.streetBet, bigBlind: game.config.bigBlind, allIn: player.status === "all-in", settings, signal });
    playSound?.("chip-bet");
  }
  const order: Player[] = [];
  for (let round = 0; round < 2; round += 1) {
    for (let offset = 1; offset <= game.players.length; offset += 1) {
      const player = game.players[(game.dealerIndex + offset) % game.players.length];
      if (player.status !== "eliminated" && player.holeCards[round]) order.push(player);
    }
  }
  const dealt = new Map<string, number>();
  for (const player of order) {
    const index = dealt.get(player.id) ?? 0;
    const target = table.querySelector<HTMLElement>(`[data-animation-id="hole-${player.id}-${index}"]`);
    const card = player.holeCards[index];
    dealt.set(player.id, index + 1);
    if (!target || !card) continue;
    await animateDealCard({ table, target, card, reveal: player.isHuman, settings, signal });
    playSound?.("deal-card");
    await wait(duration(105, settings), signal);
  }
}

export async function animateGameTransition({ table, previous, next, settings, signal, playSound }: {
  table: HTMLElement; previous: GameState; next: GameState; settings: TableMotionSettings; signal?: AbortSignal; playSound?: SoundPlayer;
}): Promise<void> {
  if (!motionScale(settings) || signal?.aborted) return;
  const action = latestAction(previous, next);
  if (action?.type === "fold") {
    await animateFoldCards({ table, playerId: action.playerId, settings, signal });
    playSound?.("fold");
  } else if (action && action.amount > 0) {
    await animatePlayerBet({ table, playerId: action.playerId, amount: action.amount, bigBlind: next.config.bigBlind, allIn: action.type === "all-in", settings, signal });
    playSound?.("chip-bet");
  }

  const streetChanged = previous.phase !== next.phase;
  if (streetChanged) {
    const contributions = streetContributions(previous, action);
    if (contributions.length) {
      await animateBetsToPot({ table, contributions, bigBlind: next.config.bigBlind, settings, signal });
      playSound?.("chips-to-pot");
    }
  }

  for (let index = previous.communityCards.length; index < next.communityCards.length; index += 1) {
    const target = table.querySelector<HTMLElement>(`[data-animation-id="community-${index}"]`);
    if (!target) continue;
    await animateDealCard({ table, target, card: next.communityCards[index], reveal: true, settings, signal, persist: true });
    playSound?.("deal-card");
    playSound?.("card-flip");
    await wait(duration(105, settings), signal);
  }

  if (next.result?.reason === "showdown") {
    const contenders = next.players.filter((player) => !player.isHuman && player.status !== "folded" && player.status !== "eliminated");
    for (const player of contenders) {
      for (let index = 0; index < player.holeCards.length; index += 1) {
        const target = table.querySelector<HTMLElement>(`[data-animation-id="hole-${player.id}-${index}"]`);
        if (!target) continue;
        await animateFlipCard({ table, target, card: player.holeCards[index], settings, signal });
        playSound?.("card-flip");
        await wait(duration(65, settings), signal);
      }
    }
  }

  if (next.result) {
    await animatePotToWinner({ table, awards: next.result.awards, bigBlind: next.config.bigBlind, settings, signal });
    playSound?.("win-pot");
  }
}

export function clearTransientTableElements(table?: HTMLElement | null): void {
  for (const element of [...transientElements]) {
    if (!table || table.contains(element)) removeTransient(element);
  }
  table?.querySelectorAll(".animation-revealed,.animation-concealed").forEach((element) => element.classList.remove("animation-revealed", "animation-concealed"));
}

export function clearAllTableAnimations(table?: HTMLElement | null): void {
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations.clear();
  clearTransientTableElements(table);
}
