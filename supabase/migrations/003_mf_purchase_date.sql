-- Add purchase_date to mf_holdings for P&L holding period tracking
ALTER TABLE mf_holdings ADD COLUMN IF NOT EXISTS purchase_date DATE;
