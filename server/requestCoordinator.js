import { AppError } from "./errorHandler.js";

export class RequestCoordinator {
  constructor() { this.byCharacter = new Map(); this.byRequest = new Map(); }
  begin(characterId, requestId) {
    if (this.byCharacter.has(characterId)) throw new AppError("CONCURRENT_REQUEST", "该电脑玩家已有一个进行中的请求。", { httpStatus: 409 });
    const controller = new AbortController();
    const entry = { characterId, requestId, controller, cancelled: false };
    this.byCharacter.set(characterId, entry);
    this.byRequest.set(requestId, entry);
    return entry;
  }
  cancel(requestId) {
    const entry = this.byRequest.get(requestId);
    if (!entry) return false;
    entry.cancelled = true;
    entry.controller.abort(new Error("User cancelled request"));
    return true;
  }
  finish(requestId) {
    const entry = this.byRequest.get(requestId);
    if (!entry) return;
    this.byRequest.delete(requestId);
    if (this.byCharacter.get(entry.characterId)?.requestId === requestId) this.byCharacter.delete(entry.characterId);
  }
  isActive(characterId, requestId) { return this.byCharacter.get(characterId)?.requestId === requestId; }
}

export const requestCoordinator = new RequestCoordinator();
