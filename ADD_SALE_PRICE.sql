-- Add sale_price to tools table
-- Serves as: for-sale price, lost-tool replacement cost, and deposit guideline
ALTER TABLE tools ADD COLUMN IF NOT EXISTS sale_price numeric(10,2) DEFAULT NULL;
