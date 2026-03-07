import {
  getCorsHeaders,
  getDb,
  json,
  optionsResponse,
  requireSessionCode,
} from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const code = await requireSessionCode(request, env);
  if (!code) {
    return json({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const db = getDb(env);
  const invite = await db
    .prepare("SELECT code, label, people_count FROM invites WHERE code = ?1 AND active = 1")
    .bind(code)
    .first();

  if (!invite) {
    return json({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const rsvp = await db
    .prepare(
      `SELECT
        attending,
        menu_choice,
        lodging_needed,
        lodging_from,
        lodging_to,
        room_people,
        notes,
        updated_at
      FROM rsvps
      WHERE code = ?1`
    )
    .bind(code)
    .first();

  const menuRowsResult = await db
    .prepare(
      `SELECT person_no, menu_choice
       FROM rsvp_menu_choices
       WHERE code = ?1
       ORDER BY person_no ASC`
    )
    .bind(code)
    .all();
  const menuRows = menuRowsResult?.results || [];
  if (rsvp && menuRows.length) {
    rsvp.menu_choices = menuRows.map((row) => row.menu_choice).filter(Boolean);
  }

  return json(
    {
      ok: true,
      invite,
      rsvp: rsvp || null,
    },
    200,
    corsHeaders
  );
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return optionsResponse(context.request);
  }
  if (context.request.method !== "GET") {
    return json({ ok: false, error: "Method Not Allowed" }, 405, getCorsHeaders(context.request));
  }
  return onRequestGet(context);
}
