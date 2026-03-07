import { getCorsHeaders, json, optionsResponse } from "./_lib.js";

const MAX_FILES_PER_UPLOAD = 20;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const DEFAULT_LIST_LIMIT = 48;
const MAX_LIST_LIMIT = 100;

function getBucket(env) {
  const bucket = env.MEDIA || env.GALLERY_BUCKET;
  if (!bucket) {
    throw new Error("Missing R2 binding. Set env.MEDIA or env.GALLERY_BUCKET.");
  }
  return bucket;
}

function sanitizeFileName(name) {
  return String(name || "file")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function buildObjectKey(fileName) {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const randomId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${yyyy}/${mm}/${dd}/${randomId}-${sanitizeFileName(fileName)}`;
}

function normalizeListItem(object) {
  const key = object.key;
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  return {
    key,
    size: object.size,
    uploaded: object.uploaded,
    contentType,
    url: `/api/gallery-file?key=${encodeURIComponent(key)}`,
  };
}

function parseLimit(rawLimit) {
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

async function listObjects(env, limit = DEFAULT_LIST_LIMIT, cursor) {
  const bucket = getBucket(env);
  const listed = await bucket.list({ limit, cursor });
  const items = (listed.objects || [])
    .sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1))
    .map(normalizeListItem);
  return {
    items,
    cursor: listed.cursor || null,
    hasMore: Boolean(listed.truncated),
  };
}

function pickFiles(formData) {
  const files = [];
  for (const [field, value] of formData.entries()) {
    if (!(value instanceof File)) continue;
    if (field !== "files" && field !== "files[]") continue;
    files.push(value);
  }
  return files;
}

async function uploadFiles(env, files) {
  const bucket = getBucket(env);
  const uploaded = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large: ${file.name}`);
    }

    const key = buildObjectKey(file.name);
    await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        originalName: file.name || "file",
      },
    });

    uploaded.push({
      key,
      name: file.name || "file",
      size: file.size,
      contentType: file.type || "application/octet-stream",
      url: `/api/gallery-file?key=${encodeURIComponent(key)}`,
    });
  }

  return uploaded;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const cursor = url.searchParams.get("cursor") || undefined;

    const result = await listObjects(env, limit, cursor);
    return json(
      {
        ok: true,
        items: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
        limit,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    return json({ ok: false, error: error.message || "Unable to list gallery." }, 500, corsHeaders);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ ok: false, error: "Use multipart/form-data." }, 400, corsHeaders);
    }

    const formData = await request.formData();
    const files = pickFiles(formData);

    if (files.length < 1) {
      return json({ ok: false, error: "No files selected." }, 400, corsHeaders);
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return json(
        { ok: false, error: `Too many files. Max ${MAX_FILES_PER_UPLOAD} per request.` },
        400,
        corsHeaders
      );
    }

    const uploaded = await uploadFiles(env, files);
    return json({ ok: true, uploaded }, 200, corsHeaders);
  } catch (error) {
    return json({ ok: false, error: error.message || "Upload failed." }, 500, corsHeaders);
  }
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return optionsResponse(context.request);
  }
  if (context.request.method === "GET") {
    return onRequestGet(context);
  }
  if (context.request.method === "POST") {
    return onRequestPost(context);
  }
  return json({ ok: false, error: "Method Not Allowed" }, 405, getCorsHeaders(context.request));
}
