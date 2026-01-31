-- Migration 003: Add source column to activities table
-- Distinguishes between Strava-synced and manually-recorded activities

ALTER TABLE activities ADD COLUMN source TEXT DEFAULT 'strava';
