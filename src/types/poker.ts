export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type Street = "preflop" | "flop" | "turn" | "river";
export type GamePhase = Street | "showdown" | "finished";
export type PlayerActionType = "fold" | "check" | "call" | "bet" | "raise" | "all-in";
export type PlayerStatus = "active" | "folded" | "all-in" | "eliminated";
export type GameMode = "quick" | "tournament";
export type AIDifficulty = "easy" | "normal" | "hard";
export type GameSpeed = "normal" | "fast" | "instant";
export type Language = "zh" | "en";

export interface PlayerAction {
  playerId: string;
  type: PlayerActionType;
  amount: number;
  street: Street;
  potAfterAction: number;
  timestamp: number;
  label?: string;
}

export interface Player {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  chips: number;
  startingChips: number;
  streetBet: number;
  totalBet: number;
  holeCards: Card[];
  status: PlayerStatus;
  acted: boolean;
  lastAction: string;
  finishPlace?: number;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
  cap: number;
}

export type SidePot = Pot;

export interface HandEvaluation {
  category: number;
  name: string;
  kickers: number[];
  cards: Card[];
}

export interface PotAward {
  potIndex: number;
  amount: number;
  winnerIds: string[];
  shares: Record<string, number>;
}

export interface HandResult {
  winnerIds: string[];
  awards: PotAward[];
  evaluations: Record<string, HandEvaluation>;
  net: Record<string, number>;
  reason: "showdown" | "uncontested";
}

export interface ReplayStep {
  index: number;
  street: GamePhase;
  communityCards: Card[];
  pot: number;
  playerChips: Record<string, number>;
  currentPlayerId: string | null;
  currentBet: number;
  actionText: string;
  action?: PlayerAction;
}

export interface HandRecord {
  id: string;
  handNumber: number;
  mode: GameMode;
  timestamp: number;
  players: Array<Pick<Player, "id" | "name" | "seat" | "startingChips">>;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  heroCards: Card[];
  communityCards: Card[];
  revealedHoleCards: Record<string, Card[]>;
  actions: PlayerAction[];
  replay: ReplayStep[];
  result: HandResult;
}

export interface TournamentState {
  blindLevel: number;
  handsAtLevel: number;
  handsUntilNextLevel: number;
  eliminatedPlayerIds: string[];
  finalStandings: string[];
  championId?: string;
}

export interface GameConfig {
  mode: GameMode;
  playerCount: number;
  aiPlayerIds?: string[];
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  aiDifficulty: AIDifficulty;
  speed: GameSpeed;
  handsPerLevel: number;
}

export interface GameState {
  id: string;
  config: GameConfig;
  players: Player[];
  deck: Card[];
  deckIndex: number;
  communityCards: Card[];
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  handNumber: number;
  currentBet: number;
  minRaise: number;
  potTotal: number;
  actions: PlayerAction[];
  replay: ReplayStep[];
  result: HandResult | null;
  tournament: TournamentState | null;
  message: string;
}

export interface StartingHandStatistics {
  key: string;
  hands: number;
  wins: number;
  netChips: number;
}

export interface GameStatistics {
  games: number;
  quickGames: number;
  tournaments: number;
  hands: number;
  handsWon: number;
  vpipHands: number;
  pfrHands: number;
  showdowns: number;
  showdownWins: number;
  netChips: number;
  biggestWin: number;
  biggestLoss: number;
  allIns: number;
  allInWins: number;
  folds: number;
  calls: number;
  raises: number;
  successfulBluffs: number;
  tournamentWins: number;
  bestTournamentPlace: number | null;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  startingHands: Record<string, StartingHandStatistics>;
}

export interface AIProfile {
  difficulty: AIDifficulty;
  aggression: number;
  bluffRate: number;
  looseness: number;
  randomness: number;
}

export interface AICharacterSetting {
  useModel: boolean;
  personality: string;
  playingStyle: string;
  prompt: string;
}

export interface Settings {
  language: Language;
  sound: boolean;
  animation: boolean;
  speed: GameSpeed;
  autoNextHand: boolean;
  cardStyle: "classic" | "minimal";
  showHints: boolean;
  showHandName: boolean;
  beginnerHelp: boolean;
  aiCharacters: Record<string, AICharacterSetting>;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  statistics: GameStatistics;
  history: HandRecord[];
  activeGame: GameState | null;
}
