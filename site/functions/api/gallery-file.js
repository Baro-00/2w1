import { getCorsHeaders, json, optionsResponse } from "./_lib.js";

function getBucket(env) {
  const bucket = env.MEDIA || env.GALLERY_BUCKET;
  if (!bucket) {
    throw new Error("Missing R2 binding. Set env.MEDIA or env.GALLERY_BUCKET.");
  }
  return bucket;
}

function safeContentType(contentType) {
  if (!contentType) return "application/octet-stream";
  if (contentType.startsWith("image/")) return contentType;
  if (contentType.startsWith("video/")) return contentType;
  return "application/octet-stream";
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return json({ ok: false, error: "Missing key." }, 400, corsHeaders);
    }

    const bucket = getBucket(env);
    const object = await bucket.get(key);
    if (!object) {
      return json({ ok: false, error: "Not found." }, 404, corsHeaders);
    }

    const headers = new Headers({
      ...corsHeaders,
      "cache-control": "public, max-age=3600",
      "content-type": safeContentType(object.httpMetadata?.contentType),
    });

    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return json({ ok: false, error: error.message || "Unable to read file." }, 500, corsHeaders);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return optionsResponse(context.request);
  }
  if (context.request.method === "GET") {
    return onRequestGet(context);
  }
  return json({ ok: false, error: "Method Not Allowed" }, 405, getCorsHeaders(context.request));
}
