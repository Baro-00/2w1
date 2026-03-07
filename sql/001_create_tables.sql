PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY CHECK(length(code) = 6),
  label TEXT NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 2 CHECK(people_count >= 1 AND people_count <= 4),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rsvps (
  code TEXT PRIMARY KEY,
  attending INTEGER NOT NULL CHECK(attending IN (0, 1)),
  menu_choice TEXT,
  lodging_needed INTEGER CHECK(lodging_needed IN (0, 1)),
  lodging_from TEXT,
  lodging_to TEXT,
  room_people INTEGER CHECK(room_people IS NULL OR (room_people >= 1 AND room_people <= 8)),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (code) REFERENCES invites(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rsvp_menu_choices (
  code TEXT NOT NULL,
  person_no INTEGER NOT NULL CHECK(person_no >= 1 AND person_no <= 4),
  menu_choice TEXT NOT NULL CHECK(menu_choice IN ('standard', 'vegetarian', 'kids')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code, person_no),
  FOREIGN KEY (code) REFERENCES rsvps(code) ON DELETE CASCADE
);
