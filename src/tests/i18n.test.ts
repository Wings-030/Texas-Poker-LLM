import { describe, expect, it } from "vitest";
import { translate, translateGameText } from "../i18n";

describe("中英文界面翻译", () => {
  it("翻译静态文案和参数文案", () => {
    expect(translate("en", "牌局统计")).toBe("Game Statistics");
    expect(translate("en", "第 {count} 手", { count: 12 })).toBe("Hand 12");
    expect(translate("en", "使用您自己的 API")).toBe("Use your own API");
    expect(translate("en", "已获取 {count} 个模型。", { count: 3 })).toBe("Loaded 3 model(s).");
    expect(translate("en", "刷新列表")).toBe("Refresh List");
    expect(translate("en", "暂无 AI 请求日志")).toBe("No AI request logs");
    expect(translate("en", "正在解析决策")).toBe("Parsing decision");
  });

  it("保留中文模式原文", () => {
    expect(translateGameText("zh", "老K 跟注 100")).toBe("老K 跟注 100");
  });

  it("翻译行动和旧复盘中的动态文案", () => {
    expect(translateGameText("en", "肥皂 跟注 100")).toBe("Soap Call 100");
    expect(translateGameText("en", "发放底牌，盲注 50/100")).toBe("Hole cards dealt · Blinds 50/100");
    expect(translateGameText("en", "摊牌：USER 赢得底池")).toBe("Showdown: USER wins the pot");
    expect(translateGameText("en", "雨伞 无需摊牌赢得 525")).toBe("Umbrella wins 525 without showdown");
  });

  it("翻译包含冠军信息的组合结算文案", () => {
    expect(translateGameText("en", "USER 赢得底池；USER 获得冠军")).toBe("USER wins the pot; USER wins the tournament");
  });
});
