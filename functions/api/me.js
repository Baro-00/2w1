import { getDb, json, requireSessionCode, unauthorized } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const code = await requireSessionCode(request, env);
  if (!code) {
    return unauthorized();
  }

  const db = getDb(env);
  const invite = await db
    .prepare("SELECT code, label FROM invites WHERE code = ?1 AND active = 1")
    .bind(code)
    .first();

  if (!invite) {
    return unauthorized();
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

  return json({
    ok: true,
    invite,
    rsvp: rsvp || null,
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }
  return onRequestGet(context);
}
