import { buildPots } from "../../engine/pots";
import { useI18n } from "../../i18n";
import type { Player } from "../../types/poker";

export function PotDisplay({ players, total }: { players: Player[]; total: number }) {
  const { t, locale } = useI18n();
  const sidePots = buildPots(players).filter((pot) => pot.eligiblePlayerIds.length > 1).slice(1);
  return (
    <div className="pot-display" data-pot>
      <span>{t("主底池")}</span><strong>{total.toLocaleString(locale)}</strong>
      {sidePots.length > 0 && <small>{sidePots.map((pot, index) => `${t("边池")} ${index + 1} ${pot.amount.toLocaleString(locale)}`).join(" · ")}</small>}
    </div>
  );
}
