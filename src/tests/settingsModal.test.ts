import { describe, expect, it, vi } from "vitest";
import { saveSettingsAndClose } from "../components/SettingsModal/SettingsModal";

describe("settings modal save and close", () => {
  it("saves AI settings before closing", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    await expect(saveSettingsAndClose("api", { save }, onClose)).resolves.toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the modal open when saving AI settings fails", async () => {
    const save = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();

    await expect(saveSettingsAndClose("api", { save }, onClose)).resolves.toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
