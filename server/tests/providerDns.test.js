import { afterEach, describe, expect, it, vi } from "vitest";
const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns", () => ({ lookup }));
import { publicLookup } from "../providerTransport.js";
afterEach(() => lookup.mockReset());

describe("provider DNS validation", () => {
  it("rejects mixed public/private DNS answers before a socket can connect", () => {
    lookup.mockImplementation((_name, _options, callback) => callback(null, [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]));
    const callback = vi.fn();
    publicLookup("mixed.example", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: "BLOCKED_API_ADDRESS" }));
  });
  it.each([true, false])("returns validated addresses directly with all=%s, without another lookup", (all) => {
    const addresses = [{ address: "8.8.8.8", family: 4 }, { address: "1.1.1.1", family: 4 }];
    lookup.mockImplementation((_name, _options, callback) => callback(null, addresses));
    const callback = vi.fn();
    publicLookup("public.example", { all }, callback);
    expect(lookup).toHaveBeenCalledTimes(1);
    if (all) expect(callback).toHaveBeenCalledWith(null, addresses);
    else expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
  });
});
