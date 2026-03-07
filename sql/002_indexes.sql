CREATE INDEX IF NOT EXISTS idx_invites_active ON invites(active);
CREATE INDEX IF NOT EXISTS idx_rsvps_updated_at ON rsvps(updated_at);
