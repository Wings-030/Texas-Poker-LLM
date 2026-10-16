import { describe, expect, it } from "vitest";
import { CARD_BACK_ASSET, cardAssetPath } from "../utils/cardAssets";

describe("card assets", () => {
  it("maps ranks and suits to the local artwork filenames", () => {
    expect(cardAssetPath({ rank: "A", suit: "hearts" })).toMatch(/cards\/H-1\.png$/);
    expect(cardAssetPath({ rank: "10", suit: "diamonds" })).toMatch(/cards\/D-10\.png$/);
    expect(cardAssetPath({ rank: "K", suit: "spades" })).toMatch(/cards\/S-13\.png$/);
    expect(CARD_BACK_ASSET).toMatch(/cards\/Back-Club\.svg$/);
  });

  it("creates a unique local asset mapping for all 52 cards", () => {
    const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
    const paths = suits.flatMap((suit) => ranks.map((rank) => cardAssetPath({ suit, rank })));

    expect(paths).toHaveLength(52);
    expect(new Set(paths).size).toBe(52);
    expect(paths.filter((path) => /\/S-/.test(path))).toHaveLength(13);
    expect(paths.filter((path) => /\/H-/.test(path))).toHaveLength(13);
    expect(paths.filter((path) => /\/D-/.test(path))).toHaveLength(13);
    expect(paths.filter((path) => /\/C-/.test(path))).toHaveLength(13);
  });
});
