-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Adds a unique constraint to experience_points to prevent double-awarding
-- the same event for the same user on the same booking.

ALTER TABLE experience_points
  ADD CONSTRAINT experience_points_user_booking_event_unique
  UNIQUE (user_id, booking_id, event_type);
