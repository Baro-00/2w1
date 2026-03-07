import { clearCookieHeader, json } from "./_lib.js";

export async function onRequestPost() {
  return json({ ok: true }, 200, { "set-cookie": clearCookieHeader() });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }
  return onRequestPost(context);
}
