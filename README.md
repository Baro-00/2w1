# 2w1

## Formularz + Cloudflare D1

### SQL

SQL do stworzenia schematu znajduje sie w:

- `sql/001_create_tables.sql`
- `sql/002_indexes.sql`
- `sql/003_seed_invites_example.sql` (opcjonalnie, przykladowe kody)
- `sql/011_add_people_count_to_invites.sql` (migracja dla istniejacej bazy)
- `sql/012_backfill_people_count.sql` (uzupelnienie people_count na podstawie etykiet)

### Wymagane bindingi / sekrety

- `DB` lub `RSVP_DB` - binding do D1
- `RSVP_COOKIE_SECRET` - sekret do podpisu ciasteczka (min. 16 znakow)

### Endpointy API (Cloudflare)

Pliki:

- `site/functions/api/login.js`
- `site/functions/api/me.js`
- `site/functions/api/rsvp.js`
- `site/functions/api/logout.js`
- `site/functions/api/gallery.js`
- `site/functions/api/gallery-file.js`

Flow:

1. `POST /api/login` z `{ "code": "ABC123" }` (dokladnie 6 znakow alfanumerycznych)
2. API ustawia `HttpOnly` cookie sesji
3. `GET /api/me` zwraca dane zaproszenia i zapisany formularz
4. `POST /api/rsvp` zapisuje/aktualizuje odpowiedz
5. `POST /api/logout` kasuje sesje
6. `GET /api/gallery` zwraca liste plikow galerii
7. `POST /api/gallery` uploaduje wiele plikow (`multipart/form-data`, pole `files`)
8. `GET /api/gallery-file?key=...` zwraca plik z R2

`invites.people_count` steruje limitem osob w formularzu RSVP (nocleg + liczba pol menu).

### Cloudflare R2 (galeria)

Dodaj binding R2 w `wrangler.jsonc`:

- `MEDIA` -> bucket na zdjecia/filmy
