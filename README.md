# 2w1

## RSVP + Cloudflare D1

### SQL

SQL do stworzenia schematu znajduje sie w:

- `sql/001_create_tables.sql`
- `sql/002_indexes.sql`
- `sql/003_seed_invites_example.sql` (opcjonalnie, przykladowe kody)

### Wymagane bindingi / sekrety

- `DB` lub `RSVP_DB` - binding do D1
- `RSVP_COOKIE_SECRET` - sekret do podpisu ciasteczka (min. 16 znakow)

### Endpointy API (Cloudflare)

Pliki:

- `scripts/api/login.js`
- `scripts/api/me.js`
- `scripts/api/rsvp.js`
- `scripts/api/logout.js`

Flow:

1. `POST /api/login` z `{ "code": "ABC123" }` (dokladnie 6 znakow alfanumerycznych)
2. API ustawia `HttpOnly` cookie sesji
3. `GET /api/me` zwraca dane zaproszenia i zapisany RSVP
4. `POST /api/rsvp` zapisuje/aktualizuje odpowiedz
5. `POST /api/logout` kasuje sesje
