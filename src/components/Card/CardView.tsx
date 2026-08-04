import type { Card } from "../../types/poker";
import { useI18n } from "../../i18n";
import { CardArtwork } from "./CardArtwork";

export function CardView({ card, hidden = false, small = false, placeholder = false, animationId, holeCard = false }: {
  card?: Card;
  hidden?: boolean;
  small?: boolean;
  placeholder?: boolean;
  animationId?: string;
  holeCard?: boolean;
}) {
  const { t } = useI18n();
  const animationProps = { "data-animation-id": animationId, "data-hole-card": holeCard ? "true" : undefined };
  if (placeholder && !card) return <div className={`playing-card card-slot ${small ? "small" : ""}`} aria-hidden="true" {...animationProps} />;
  if (hidden || !card) return (
    <div className={`playing-card card-back ${small ? "small" : ""}`} aria-label={t("背面朝上的牌")} {...animationProps}>
      <CardArtwork />
    </div>
  );
  return (
    <div className={`playing-card card-front ${small ? "small" : ""}`} data-rank={card.rank} aria-label={`${card.rank} ${card.suit}`} {...animationProps}>
      <CardArtwork card={card} />
    </div>
  );
}
