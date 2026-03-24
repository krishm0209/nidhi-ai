-- Add unique constraint for tax_deductions upsert support
ALTER TABLE public.tax_deductions
  ADD CONSTRAINT tax_deductions_member_fy_section_instrument_key
  UNIQUE (member_id, financial_year, section, instrument);
