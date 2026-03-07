const COOKIE_NAME = "rsvp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;

function badRequest(message) {
  return json({ ok: false, error: message }, 400);
}

function unauthorized() {
  return json({ ok: false, error: "Unauthorized" }, 401);
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function getCorsHeaders(request) {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    vary: "Origin",
  };
}

function optionsResponse(request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(request),
      "cache-control": "no-store",
    },
  });
}

function getDb(env) {
  const db = env.DB || env.RSVP_DB;
  if (!db) {
    throw new Error("Missing D1 binding. Set env.DB or env.RSVP_DB.");
  }
  return db;
}

function getCookieSecret(env) {
  const secret = env.RSVP_COOKIE_SECRET;
  if (!secret || typeof secret !== "string" || secret.length < 16) {
    throw new Error("Missing RSVP_COOKIE_SECRET (min 16 chars).");
  }
  return secret;
}

function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  const pairs = header.split(";");
  for (const pairRaw of pairs) {
    const pair = pairRaw.trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key !== name) continue;
    return pair.slice(eq + 1);
  }
  return null;
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(text) {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function signText(text, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return toBase64Url(new Uint8Array(signature));
}

async function encodeSession(code, secret) {
  const payload = `${code}|${Math.floor(Date.now() / 1000)}`;
  const signature = await signText(payload, secret);
  return `${toBase64Url(new TextEncoder().encode(payload))}.${signature}`;
}

async function decodeSession(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const payloadBytes = fromBase64Url(parts[0]);
  const payload = new TextDecoder().decode(payloadBytes);
  const expectedSignature = await signText(payload, secret);
  if (expectedSignature !== parts[1]) return null;

  const [code, issuedAtRaw] = payload.split("|");
  const issuedAt = Number(issuedAtRaw);
  if (!code || !Number.isFinite(issuedAt)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (issuedAt + SESSION_TTL_SECONDS < now) return null;

  return { code };
}

function buildSetCookie(value, maxAgeSeconds) {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ];

  if (typeof maxAgeSeconds === "number") {
    attrs.push(`Max-Age=${maxAgeSeconds}`);
  }

  return attrs.join("; ");
}

function clearCookieHeader() {
  return buildSetCookie("", 0);
}

function validateCode(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return null;
  }
  return code;
}

async function requireSessionCode(request, env) {
  const secret = getCookieSecret(env);
  const token = readCookie(request, COOKIE_NAME);
  const session = await decodeSession(token, secret);
  return session?.code || null;
}

export {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  badRequest,
  clearCookieHeader,
  decodeSession,
  encodeSession,
  getCookieSecret,
  getDb,
  json,
  getCorsHeaders,
  optionsResponse,
  readCookie,
  requireSessionCode,
  unauthorized,
  validateCode,
  buildSetCookie,
};
