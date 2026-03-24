-- ============================================
-- NidhiAI - Initial Schema
-- Run in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  pan_hash TEXT,
  date_of_birth DATE,
  risk_profile TEXT CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
  groww_api_key_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HOUSEHOLDS
-- ============================================
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  date_of_birth DATE,
  is_active BOOLEAN DEFAULT FALSE,
  visibility TEXT DEFAULT 'summary'
    CHECK (visibility IN ('full', 'summary', 'networth_only')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STOCK HOLDINGS
-- ============================================
CREATE TABLE public.stock_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  exchange TEXT DEFAULT 'NSE',
  quantity INTEGER NOT NULL,
  average_price DECIMAL(12,2) NOT NULL,
  purchase_date DATE,
  broker_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MUTUAL FUND HOLDINGS
-- ============================================
CREATE TABLE public.mf_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  scheme_code INTEGER NOT NULL,
  scheme_name TEXT NOT NULL,
  folio_number TEXT,
  units DECIMAL(14,4) NOT NULL,
  purchase_nav DECIMAL(10,4),
  fund_type TEXT,
  is_sip BOOLEAN DEFAULT FALSE,
  sip_amount DECIMAL(10,2),
  sip_date INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CRYPTO HOLDINGS
-- ============================================
CREATE TABLE public.crypto_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  coin_id TEXT NOT NULL,
  coin_symbol TEXT NOT NULL,
  quantity DECIMAL(18,8) NOT NULL,
  average_price_inr DECIMAL(14,2) NOT NULL,
  exchange_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FIXED INCOME
-- ============================================
CREATE TABLE public.fixed_income_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  instrument_type TEXT NOT NULL
    CHECK (instrument_type IN ('fd', 'ppf', 'nps', 'ssy', 'rd', 'scss', 'sgb', 'bonds', 'lic', 'post_office')),
  institution TEXT,
  principal DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2),
  maturity_date DATE,
  current_value DECIMAL(14,2),
  nps_equity_pct INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GOLD HOLDINGS
-- ============================================
CREATE TABLE public.gold_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  form TEXT NOT NULL
    CHECK (form IN ('physical', 'digital', 'sgb', 'gold_etf', 'gold_mf')),
  weight_grams DECIMAL(10,3),
  purchase_price_per_gram DECIMAL(10,2),
  units DECIMAL(10,4),
  purchase_nav DECIMAL(10,4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RAG DOCUMENT EMBEDDINGS
-- ============================================
CREATE TABLE public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON public.document_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- AI CHAT
-- ============================================
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRICE CACHE (fallback)
-- ============================================
CREATE TABLE public.price_cache (
  symbol TEXT PRIMARY KEY,
  price DECIMAL(14,2) NOT NULL,
  change_pct DECIMAL(6,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MF UNDERLYING HOLDINGS (for overlap/exposure)
-- ============================================
CREATE TABLE public.mf_underlying_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code INTEGER NOT NULL,
  stock_name TEXT NOT NULL,
  stock_isin TEXT,
  weight_pct DECIMAL(6,3) NOT NULL,
  as_of_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_code, stock_isin, as_of_date)
);

CREATE INDEX idx_mf_underlying_scheme ON public.mf_underlying_holdings(scheme_code);
CREATE INDEX idx_mf_underlying_stock ON public.mf_underlying_holdings(stock_isin);

-- ============================================
-- PORTFOLIO X-RAY SCORES
-- ============================================
CREATE TABLE public.xray_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  overall_score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  breakdown JSONB NOT NULL,
  recommendations JSONB DEFAULT '[]',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SIP TRACKING
-- ============================================
CREATE TABLE public.sip_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  scheme_code INTEGER NOT NULL,
  scheme_name TEXT NOT NULL,
  sip_amount DECIMAL(10,2) NOT NULL,
  sip_day INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  goal_name TEXT,
  goal_target_amount DECIMAL(14,2),
  goal_target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sip_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sip_id UUID NOT NULL REFERENCES public.sip_records(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  nav DECIMAL(10,4) NOT NULL,
  units_allotted DECIMAL(14,4) NOT NULL,
  status TEXT DEFAULT 'success'
    CHECK (status IN ('success', 'missed', 'bounced')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAX DEDUCTIONS
-- ============================================
CREATE TABLE public.tax_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  section TEXT NOT NULL,
  instrument TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  institution TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BENCHMARK AGGREGATES (Phase 3)
-- ============================================
CREATE TABLE public.benchmark_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_bracket TEXT NOT NULL,
  metric TEXT NOT NULL,
  percentile_10 DECIMAL(10,2),
  percentile_25 DECIMAL(10,2),
  percentile_50 DECIMAL(10,2),
  percentile_75 DECIMAL(10,2),
  percentile_90 DECIMAL(10,2),
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(age_bracket, metric)
);

-- ============================================
-- PORTFOLIO WRAPPED (Phase 3)
-- ============================================
CREATE TABLE public.wrapped_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  year INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  card_images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- ============================================
-- HELPER: updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.stock_holdings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.mf_holdings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.crypto_holdings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.fixed_income_holdings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
