import { Fragment, type RefObject } from "react";
import { CardArtwork } from "../Card/CardArtwork";
import { CardView } from "../Card/CardView";
import { PlayerSeat } from "../PlayerSeat/PlayerSeat";
import { PotDisplay } from "../PotDisplay/PotDisplay";
import { findAIPlayer } from "../../data/aiPlayers";
import { useI18n } from "../../i18n";
import type { GameState } from "../../types/poker";

const PHASE_LABELS = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌", finished: "结束" } as const;

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
      <div className="table-monogram" aria-hidden="true"><span>♠</span><small>Texas Hold’em LLM</small></div>
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
      {game.players.map((player) => {
        const aiPlayer = findAIPlayer(player.id);
        const isActive = game.players[game.currentPlayerIndex]?.id === player.id && game.phase !== "showdown";
        const isThinkingPlayer = Boolean(aiPlayer && isActive && thinking && tableTalk?.playerId !== player.id);
        const bubbleText = tableTalk?.playerId === player.id ? tableTalk.text : "";
        return <Fragment key={player.id}>
          {aiPlayer && (bubbleText || isThinkingPlayer) && <div className={`table-talk-bubble talk-seat-${player.seat} ${isThinkingPlayer ? "thinking-talk" : ""}`} role="status" aria-live="polite">
            {isThinkingPlayer ? <span className="thinking-talk-content">{t("正在思考中")}<span className="thinking-talk-dots" aria-hidden="true"><i /><i /><i /></span></span> : bubbleText}
          </div>}
          <PlayerSeat
            player={player}
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
