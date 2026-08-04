import { useEffect, useState } from "react";
import type { Card } from "../../types/poker";
import { CARD_BACK_ASSET, cardAssetPath, logCardAssetFailure } from "../../utils/cardAssets";

export function CardArtwork({ card, className }: { card?: Card; className?: string }) {
  const path = card ? cardAssetPath(card) : CARD_BACK_ASSET;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [path]);

  if (failed) return (
    <span className={`${className ? `${className} ` : ""}card-artwork-fallback`} aria-hidden="true">
      <strong>{card?.rank ?? "CARD"}</strong>
      <small>{card?.suit.toUpperCase() ?? "BACK"}</small>
    </span>
  );

  return <img className={className} src={path} alt="" draggable="false" onError={() => {
    logCardAssetFailure(card, path);
    setFailed(true);
  }} />;
}
