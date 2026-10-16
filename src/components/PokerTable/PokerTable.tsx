import { Fragment, type CSSProperties, type RefObject } from "react";
import { CardArtwork } from "../Card/CardArtwork";
import { CardView } from "../Card/CardView";
import { PlayerSeat } from "../PlayerSeat/PlayerSeat";
import { PotDisplay } from "../PotDisplay/PotDisplay";
import { findAIPlayer } from "../../data/aiPlayers";
import { useI18n } from "../../i18n";
import type { GameState } from "../../types/poker";

const PHASE_LABELS = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌", finished: "结束" } as const;

// Clockwise seats keep the human at the bottom and distribute small tables evenly.
const SEAT_LAYOUTS: Record<number, number[][]> = {
  2: [[50, 100], [50, 0]],
  3: [[50, 100], [0, 30], [100, 30]],
  4: [[50, 100], [0, 50], [50, 0], [100, 50]],
  5: [[50, 100], [0, 65], [22, 0], [78, 0], [100, 65]],
  6: [[50, 100], [0, 68], [0, 20], [50, 0], [100, 20], [100, 68]],
  7: [[50, 100], [0, 72], [0, 25], [30, 0], [70, 0], [100, 25], [100, 72]],
  8: [[50, 100], [0, 75], [0, 28], [20, 0], [50, 0], [80, 0], [100, 28], [100, 75]],
  9: [[35, 100], [0, 75], [0, 28], [20, 0], [50, 0], [80, 0], [100, 28], [100, 75], [70, 100]],
};

export function PokerTable({ game, thinking, tableTalk, tableRef, concealHoleCards = false }: {
  game: GameState;
  thinking: boolean;
  tableTalk?: { playerId: string; text: string } | null;
  tableRef?: RefObject<HTMLDivElement | null>;
  concealHoleCards?: boolean;
}) {
  const { t, text } = useI18n();
  const reveal = game.phase === "showdown" && game.result?.reason === "showdown";
  const currentPlayer = game.players[game.currentPlayerIndex];
  return (
    <div ref={tableRef} className={`poker-table ${game.config.mode}-table table-${game.players.length} ${concealHoleCards ? "dealing-hand" : ""}`} aria-busy={concealHoleCards || undefined}>
      <div className="felt-texture" />
      <div className="card-deck" data-card-deck aria-hidden="true">
        <CardArtwork className="deck-card deck-card-bottom" />
        <CardArtwork className="deck-card deck-card-middle" />
        <CardArtwork className="deck-card deck-card-top" />
      </div>
      <div className="discard-pile" data-discard-pile aria-hidden="true" />
      <div className="table-monogram" aria-hidden="true"><span>♠</span><small>THE PRIVATE TABLE</small></div>
      <div className="table-round-status" aria-label={t("当前牌局状态")}>
        <span><small>{t("阶段")}</small><strong>{t(PHASE_LABELS[game.phase])}</strong></span>
        <span><small>{t("当前下注")}</small><strong>{game.currentBet.toLocaleString()}</strong></span>
        <span><small>{t("行动玩家")}</small><strong>{currentPlayer ? currentPlayer.isHuman ? "USER" : text(currentPlayer.name) : "—"}</strong></span>
      </div>
      <div className="community-area">
        <div className="community-cards">
          {Array.from({ length: 5 }, (_, index) => <CardView key={index} card={game.communityCards[index]} placeholder={!game.communityCards[index]} animationId={`community-${index}`} />)}
        </div>
        <PotDisplay players={game.players} total={game.potTotal} />
      </div>
      {game.players.map((player, index) => {
        const [x, y] = SEAT_LAYOUTS[game.players.length][index];
        const seatStyle = { "--seat-x": `${x}%`, "--seat-y": `${y}%` } as CSSProperties;
        const edge = y === 0 ? "top" : y === 100 ? "bottom" : x === 0 ? "left" : "right";
        const aiPlayer = findAIPlayer(player.id);
        const isActive = game.players[game.currentPlayerIndex]?.id === player.id && game.phase !== "showdown";
        const isThinkingPlayer = Boolean(aiPlayer && isActive && thinking && tableTalk?.playerId !== player.id);
        const bubbleText = tableTalk?.playerId === player.id ? tableTalk.text : "";
        return <Fragment key={player.id}>
          {aiPlayer && (bubbleText || isThinkingPlayer) && <div className={`table-talk-bubble ${isThinkingPlayer ? "thinking-talk" : ""}`} style={seatStyle} data-edge={edge} role="status" aria-live="polite">
            {isThinkingPlayer ? <span className="thinking-talk-content">{t("正在思考中")}<span className="thinking-talk-dots" aria-hidden="true"><i /><i /><i /></span></span> : bubbleText}
          </div>}
          <PlayerSeat
            player={player}
            style={seatStyle}
            edge={edge}
            active={isActive}
            dealer={game.players[game.dealerIndex]?.id === player.id}
            blind={game.players[game.smallBlindIndex]?.id === player.id ? "SB" : game.players[game.bigBlindIndex]?.id === player.id ? "BB" : undefined}
            reveal={Boolean(reveal && player.status !== "folded" && player.status !== "eliminated")}
            thinking={isThinkingPlayer}
            concealHoleCards={concealHoleCards}
            winner={Boolean(game.result?.winnerIds.includes(player.id))}
          />
        </Fragment>;
      })}
      <div className="table-animation-layer" data-table-animation-layer aria-hidden="true" />
    </div>
  );
}
