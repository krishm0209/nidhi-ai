-- ============================================
-- RLS Policies for NidhiAI
-- Run after 001_initial_schema.sql
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_income_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xray_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrapped_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- Helper function: get household ids for current user
-- ============================================
CREATE OR REPLACE FUNCTION public.my_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.households WHERE owner_id = auth.uid()
  UNION
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
$$;

-- Helper function: get member ids accessible by current user
CREATE OR REPLACE FUNCTION public.my_member_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT hm.id FROM public.household_members hm
  WHERE hm.household_id IN (SELECT public.my_household_ids())
$$;

-- ============================================
-- HOUSEHOLDS
-- ============================================
CREATE POLICY "Household owner full access"
  ON public.households FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  ));

-- ============================================
-- HOUSEHOLD MEMBERS
-- ============================================
CREATE POLICY "Owner can manage household members"
  ON public.household_members FOR ALL
  USING (household_id IN (
    SELECT id FROM public.households WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Active members can view their own record"
  ON public.household_members FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- STOCK HOLDINGS
-- ============================================
CREATE POLICY "Users can view holdings in their households"
  ON public.stock_holdings FOR SELECT
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert holdings for their members"
  ON public.stock_holdings FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can update holdings in their households"
  ON public.stock_holdings FOR UPDATE
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can delete holdings in their households"
  ON public.stock_holdings FOR DELETE
  USING (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- MF HOLDINGS
-- ============================================
CREATE POLICY "Users can view mf holdings in their households"
  ON public.mf_holdings FOR SELECT
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert mf holdings for their members"
  ON public.mf_holdings FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can update mf holdings in their households"
  ON public.mf_holdings FOR UPDATE
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can delete mf holdings in their households"
  ON public.mf_holdings FOR DELETE
  USING (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- CRYPTO HOLDINGS
-- ============================================
CREATE POLICY "Users can view crypto holdings in their households"
  ON public.crypto_holdings FOR SELECT
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert crypto holdings for their members"
  ON public.crypto_holdings FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can update crypto holdings in their households"
  ON public.crypto_holdings FOR UPDATE
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can delete crypto holdings in their households"
  ON public.crypto_holdings FOR DELETE
  USING (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- FIXED INCOME HOLDINGS
-- ============================================
CREATE POLICY "Users can view fixed income holdings in their households"
  ON public.fixed_income_holdings FOR SELECT
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert fixed income holdings for their members"
  ON public.fixed_income_holdings FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can update fixed income holdings in their households"
  ON public.fixed_income_holdings FOR UPDATE
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can delete fixed income holdings in their households"
  ON public.fixed_income_holdings FOR DELETE
  USING (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- GOLD HOLDINGS
-- ============================================
CREATE POLICY "Users can view gold holdings in their households"
  ON public.gold_holdings FOR SELECT
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert gold holdings for their members"
  ON public.gold_holdings FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can update gold holdings in their households"
  ON public.gold_holdings FOR UPDATE
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can delete gold holdings in their households"
  ON public.gold_holdings FOR DELETE
  USING (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- CHAT
-- ============================================
CREATE POLICY "Users can manage own chat sessions"
  ON public.chat_sessions FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in own sessions"
  ON public.chat_messages FOR SELECT
  USING (session_id IN (
    SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own sessions"
  ON public.chat_messages FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
  ));

-- ============================================
-- XRAY SCORES
-- ============================================
CREATE POLICY "Users can view own xray scores"
  ON public.xray_scores FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own xray scores"
  ON public.xray_scores FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own xray scores"
  ON public.xray_scores FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- SIP RECORDS
-- ============================================
CREATE POLICY "Users can view sip records in their households"
  ON public.sip_records FOR SELECT
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert sip records for their members"
  ON public.sip_records FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can update sip records in their households"
  ON public.sip_records FOR UPDATE
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can delete sip records in their households"
  ON public.sip_records FOR DELETE
  USING (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- SIP TRANSACTIONS
-- ============================================
CREATE POLICY "Users can view sip transactions for their sips"
  ON public.sip_transactions FOR SELECT
  USING (sip_id IN (
    SELECT id FROM public.sip_records
    WHERE member_id IN (SELECT public.my_member_ids())
  ));

CREATE POLICY "Users can insert sip transactions for their sips"
  ON public.sip_transactions FOR INSERT
  WITH CHECK (sip_id IN (
    SELECT id FROM public.sip_records
    WHERE member_id IN (SELECT public.my_member_ids())
  ));

-- ============================================
-- TAX DEDUCTIONS
-- ============================================
CREATE POLICY "Users can manage tax deductions in their households"
  ON public.tax_deductions FOR ALL
  USING (member_id IN (SELECT public.my_member_ids()));

CREATE POLICY "Users can insert tax deductions for their members"
  ON public.tax_deductions FOR INSERT
  WITH CHECK (member_id IN (SELECT public.my_member_ids()));

-- ============================================
-- WRAPPED REPORTS
-- ============================================
CREATE POLICY "Users can view own wrapped reports"
  ON public.wrapped_reports FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own wrapped reports"
  ON public.wrapped_reports FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- Public read access for reference tables
-- ============================================
-- mf_underlying_holdings: read-only for all authenticated users
ALTER TABLE public.mf_underlying_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read mf underlying holdings"
  ON public.mf_underlying_holdings FOR SELECT
  USING (auth.role() = 'authenticated');

-- benchmark_aggregates: public read (aggregated, no PII)
ALTER TABLE public.benchmark_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read benchmark aggregates"
  ON public.benchmark_aggregates FOR SELECT
  USING (true);

-- document_embeddings: authenticated read (for RAG)
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read document embeddings"
  ON public.document_embeddings FOR SELECT
  USING (auth.role() = 'authenticated');

-- price_cache: authenticated read
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read price cache"
  ON public.price_cache FOR SELECT
  USING (auth.role() = 'authenticated');
