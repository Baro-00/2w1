import {
  getCorsHeaders,
  getDb,
  json,
  optionsResponse,
  requireSessionCode,
} from "./_lib.js";

const LODGING_MIN = "2026-06-03";
const LODGING_MAX = "2026-06-07";
const ALLOWED_MENU = new Set(["standard", "vegetarian", ""]);

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes" || v === "tak") return true;
    if (v === "0" || v === "false" || v === "no" || v === "nie") return false;
  }
  return null;
}

function normalizeDate(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

function parsePayload(raw) {
  const attending = normalizeBoolean(raw.attending);
  if (attending === null) return { error: "attending is required." };

  const lodgingNeeded = normalizeBoolean(raw.lodgingNeeded);
  const lodgingFrom = normalizeDate(raw.lodgingFrom);
  const lodgingTo = normalizeDate(raw.lodgingTo);

  if (lodgingNeeded && (!lodgingFrom || !lodgingTo)) {
    return { error: "lodgingFrom and lodgingTo are required when lodgingNeeded = true." };
  }

  const roomPeopleRaw = raw.roomPeople;
  let roomPeople = null;
  if (roomPeopleRaw != null && String(roomPeopleRaw).trim() !== "") {
    roomPeople = Number(roomPeopleRaw);
    if (!Number.isInteger(roomPeople) || roomPeople < 1 || roomPeople > 8) {
      return { error: "roomPeople must be integer in range 1..8." };
    }
  }

  const menuChoice = String(raw.menuChoice || "").trim().toLowerCase().slice(0, 64);
  if (!ALLOWED_MENU.has(menuChoice)) {
    return { error: "menuChoice must be one of: standard, vegetarian." };
  }

  if (lodgingNeeded) {
    if (lodgingFrom < LODGING_MIN || lodgingFrom > LODGING_MAX) {
      return { error: "lodgingFrom must be between 2026-06-03 and 2026-06-07." };
    }
    if (lodgingTo < LODGING_MIN || lodgingTo > LODGING_MAX) {
      return { error: "lodgingTo must be between 2026-06-03 and 2026-06-07." };
    }
    if (lodgingFrom > lodgingTo) {
      return { error: "lodgingFrom cannot be after lodgingTo." };
    }
  }

  const notes = String(raw.notes || "").trim().slice(0, 1000) || null;

  return {
    payload: {
      attending: attending ? 1 : 0,
      menuChoice: menuChoice || null,
      lodgingNeeded: lodgingNeeded == null ? null : lodgingNeeded ? 1 : 0,
      lodgingFrom: lodgingNeeded ? lodgingFrom : null,
      lodgingTo: lodgingNeeded ? lodgingTo : null,
      roomPeople: lodgingNeeded ? roomPeople : null,
      notes,
    },
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const code = await requireSessionCode(request, env);
  if (!code) {
    return json({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ ok: false, error: "Use application/json." }, 400, corsHeaders);
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return json({ ok: false, error: "Invalid JSON payload." }, 400, corsHeaders);
  }

  const parsed = parsePayload(raw);
  if (parsed.error) {
    return json({ ok: false, error: parsed.error }, 400, corsHeaders);
  }

  const db = getDb(env);
  await db
    .prepare(
      `INSERT INTO rsvps (
        code,
        attending,
        menu_choice,
        lodging_needed,
        lodging_from,
        lodging_to,
        room_people,
        notes,
        updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP)
      ON CONFLICT(code) DO UPDATE SET
        attending = excluded.attending,
        menu_choice = excluded.menu_choice,
        lodging_needed = excluded.lodging_needed,
        lodging_from = excluded.lodging_from,
        lodging_to = excluded.lodging_to,
        room_people = excluded.room_people,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP`
    )
    .bind(
      code,
      parsed.payload.attending,
      parsed.payload.menuChoice,
      parsed.payload.lodgingNeeded,
      parsed.payload.lodgingFrom,
      parsed.payload.lodgingTo,
      parsed.payload.roomPeople,
      parsed.payload.notes
    )
    .run();

  return json({ ok: true }, 200, corsHeaders);
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
