import {
  badRequest,
  buildSetCookie,
  encodeSession,
  getCookieSecret,
  getDb,
  json,
  validateCode,
} from "./_lib.js";

async function extractCode(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return body?.code;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return form.get("code");
  }

  const url = new URL(request.url);
  return url.searchParams.get("code");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const code = validateCode(await extractCode(request));
  if (!code) {
    return badRequest("Code must have 6 letters/digits.");
  }

  const db = getDb(env);
  const found = await db
    .prepare("SELECT code, label FROM invites WHERE code = ?1 AND active = 1")
    .bind(code)
    .first();

  if (!found) {
    return json({ ok: false, error: "Invalid code." }, 401);
  }

  const secret = getCookieSecret(env);
  const token = await encodeSession(code, secret);

  return json(
    { ok: true, invite: { code: found.code, label: found.label } },
    200,
    { "set-cookie": buildSetCookie(token) }
  );
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }
  return onRequestPost(context);
}
