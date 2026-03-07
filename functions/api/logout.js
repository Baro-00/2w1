import { clearCookieHeader, getCorsHeaders, json, optionsResponse } from "./_lib.js";

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return json({ ok: true }, 200, { "set-cookie": clearCookieHeader(), ...corsHeaders });
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return optionsResponse(context.request);
  }
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "Method Not Allowed" }, 405, getCorsHeaders(context.request));
  }
  return onRequestPost(context);
}
