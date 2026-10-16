import { CardView } from "../Card/CardView";
import { PlayerAvatar } from "./PlayerAvatar";
import { findAIPlayer } from "../../data/aiPlayers";
import { useI18n } from "../../i18n";
import type { Player } from "../../types/poker";
import type { CSSProperties } from "react";

export function PlayerSeat({ player, style, edge, active, dealer, blind, reveal, thinking = false, concealHoleCards = false, winner = false }: {
  player: Player;
  style: CSSProperties;
  edge: string;
  active: boolean;
  dealer: boolean;
  blind?: "SB" | "BB";
  reveal: boolean;
  thinking?: boolean;
  concealHoleCards?: boolean;
  winner?: boolean;
}) {
  const { t, text, locale } = useI18n();
  const visible = player.isHuman || reveal;
  const showHoleCards = player.status !== "folded" && player.status !== "eliminated";
  const avatarLabel = player.isHuman ? "U" : findAIPlayer(player.id)?.code ?? "AI";
  return (
    <div
      className={`player-seat seat-${player.seat} ${player.isHuman ? "hero-seat" : ""} ${active ? "active" : ""} ${thinking ? "thinking" : ""} ${winner ? "winner" : ""} ${player.status}`}
      aria-current={active ? "true" : undefined}
      data-state={thinking ? "thinking" : player.status}
      data-player-id={player.id}
      style={style}
      data-edge={edge}
    >
      <PlayerAvatar code={avatarLabel} className="avatar" />
      <div className="seat-info">
        <div className="seat-name"><strong>{text(player.name)}</strong><span className="seat-markers">{dealer && <span className="dealer-chip">D</span>}{blind && <span className={`blind-chip blind-${blind.toLowerCase()}`}>{blind}</span>}</span></div>
        <span className="chip-count" data-chip-count>{player.chips.toLocaleString(locale)} {t("筹码")}</span>
        <span className="player-action">{thinking ? t("正在思考中") : player.status === "folded" ? t("已弃牌") : player.status === "all-in" ? t("全下") : player.status === "eliminated" ? t("已淘汰") : text(player.lastAction)}</span>
      </div>
      {active && <span className="turn-indicator"><i aria-hidden="true" />{thinking ? t("思考中") : t("轮到行动")}</span>}
      <span className={`seat-bet ${player.streetBet <= 0 ? "empty" : ""}`} data-player-bet={player.id} aria-hidden={player.streetBet <= 0 || undefined}>{player.streetBet > 0 ? `${t("下注")} ${player.streetBet}` : ""}</span>
      {showHoleCards && <div className={`hole-cards ${concealHoleCards ? "concealed" : ""}`}>
        {player.holeCards.map((card, index) => <CardView key={index} card={card} hidden={!visible} small={!player.isHuman} animationId={`hole-${player.id}-${index}`} holeCard />)}
      </div>}
    </div>
  );
}
