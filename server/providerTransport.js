import { lookup } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";
import ipaddr from "ipaddr.js";
import { AppError } from "./errorHandler.js";

function blockedAddress() {
  return new AppError("BLOCKED_API_ADDRESS", "API 地址必须指向公网服务；本地部署可通过 AI_ALLOW_PRIVATE_ENDPOINTS=true 启用本地模型。", { httpStatus: 400 });
}

export function isPublicAddress(address) {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  return parsed.range() === "unicast" && (parsed.kind() === "ipv4" || parsed.match(ipaddr.parse("2000::"), 3));
}

// Validate the addresses used by the socket itself, avoiding a second DNS lookup.
export function publicLookup(hostname, options, callback) {
  lookup(hostname, { all: true, family: options.family ?? 0 }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) return callback(blockedAddress());
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

const publicAgent = new Agent({ connect: { lookup: publicLookup } });
const localAgent = new Agent();

export async function fetchProvider(requestUrl, options) {
  const url = new URL(requestUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const allowPrivate = process.env.AI_ALLOW_PRIVATE_ENDPOINTS === "true";
  if (!allowPrivate && isIP(hostname) && !isPublicAddress(hostname)) throw blockedAddress();
  const response = await fetch(url, { ...options, redirect: "manual", dispatcher: allowPrivate ? localAgent : publicAgent });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new AppError("INVALID_BASE_URL", "API 地址返回了重定向，请直接填写服务商的最终 API 地址。", { httpStatus: 400 });
  }
  return response;
}
