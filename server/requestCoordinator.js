import { AppError } from "./errorHandler.js";

export class RequestCoordinator {
  constructor() { this.byCharacter = new Map(); this.byRequest = new Map(); }
  begin(characterId, requestId, scope = "local") {
    const characterKey = JSON.stringify([scope, characterId]);
    const requestKey = JSON.stringify([scope, requestId]);
    if (this.byCharacter.has(characterKey) || this.byRequest.has(requestKey)) throw new AppError("CONCURRENT_REQUEST", "该电脑玩家已有一个进行中的请求。", { httpStatus: 409 });
    const controller = new AbortController();
    const entry = { characterId, characterKey, requestId, controller, cancelled: false };
    this.byCharacter.set(characterKey, entry);
    this.byRequest.set(requestKey, entry);
    return entry;
  }
  cancel(requestId, scope = "local") {
    const entry = this.byRequest.get(JSON.stringify([scope, requestId]));
    if (!entry) return false;
    entry.cancelled = true;
    entry.controller.abort(new Error("User cancelled request"));
    return true;
  }
  finish(requestId, scope = "local") {
    const requestKey = JSON.stringify([scope, requestId]);
    const entry = this.byRequest.get(requestKey);
    if (!entry) return;
    this.byRequest.delete(requestKey);
    if (this.byCharacter.get(entry.characterKey)?.requestId === requestId) this.byCharacter.delete(entry.characterKey);
  }
  isActive(characterId, requestId, scope = "local") { return this.byCharacter.get(JSON.stringify([scope, characterId]))?.requestId === requestId; }
}

export const requestCoordinator = new RequestCoordinator();
