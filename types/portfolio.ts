// =============================================
// Core portfolio TypeScript types for NidhiAI
// =============================================

export type Exchange = 'NSE' | 'BSE'
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive'
export type MemberVisibility = 'full' | 'summary' | 'networth_only'
export type Relationship = 'self' | 'spouse' | 'father' | 'mother' | 'child' | 'sibling' | 'other'
export type FixedIncomeType = 'fd' | 'ppf' | 'nps' | 'ssy' | 'rd' | 'scss' | 'sgb' | 'bonds' | 'lic' | 'post_office'
export type GoldForm = 'physical' | 'digital' | 'sgb' | 'gold_etf' | 'gold_mf'
export type FundType = 'Equity' | 'Debt' | 'Hybrid' | 'ELSS' | 'Index' | 'Other'

// =============================================
// Database row types (matches Supabase schema)
// =============================================

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  pan_hash: string | null
  date_of_birth: string | null
  risk_profile: RiskProfile | null
  groww_api_key_encrypted: string | null
  created_at: string
  updated_at: string
}

export interface Household {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string | null
  name: string
  relationship: Relationship
  date_of_birth: string | null
  is_active: boolean
  visibility: MemberVisibility
  created_at: string
}

export interface StockHolding {
  id: string
  member_id: string
  symbol: string
  exchange: Exchange
  quantity: number
  average_price: number
  purchase_date: string | null
  broker_source: string | null
  created_at: string
  updated_at: string
}

export interface MFHolding {
  id: string
  member_id: string
  scheme_code: number
  scheme_name: string
  folio_number: string | null
  units: number
  purchase_nav: number | null
  purchase_date: string | null
  fund_type: FundType | null
  is_sip: boolean
  sip_amount: number | null
  sip_date: number | null
  created_at: string
  updated_at: string
}

export interface CryptoHolding {
  id: string
  member_id: string
  coin_id: string
  coin_symbol: string
  quantity: number
  average_price_inr: number
  exchange_source: string | null
  created_at: string
  updated_at: string
}

export interface FixedIncomeHolding {
  id: string
  member_id: string
  instrument_type: FixedIncomeType
  institution: string | null
  principal: number
  interest_rate: number | null
  maturity_date: string | null
  current_value: number | null
  nps_equity_pct: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GoldHolding {
  id: string
  member_id: string
  form: GoldForm
  weight_grams: number | null
  purchase_price_per_gram: number | null
  units: number | null
  purchase_nav: number | null
  notes: string | null
  created_at: string
}

// =============================================
// Enriched types (with live market data)
// =============================================

export interface StockHoldingEnriched extends StockHolding {
  current_price: number
  current_value: number
  invested_value: number
  gain_loss: number
  gain_loss_pct: number
  day_change_pct: number
}

export interface MFHoldingEnriched extends MFHolding {
  current_nav: number
  current_value: number
  invested_value: number
  gain_loss: number
  gain_loss_pct: number
}

export interface CryptoHoldingEnriched extends CryptoHolding {
  current_price_inr: number
  current_value: number
  invested_value: number
  gain_loss: number
  gain_loss_pct: number
}

// =============================================
// Portfolio summary
// =============================================

export interface AssetAllocation {
  equity: number
  debt: number
  gold: number
  crypto: number
  total: number
  equity_pct: number
  debt_pct: number
  gold_pct: number
  crypto_pct: number
}

export interface PortfolioSummary {
  total_value: number
  total_invested: number
  total_gain_loss: number
  total_gain_loss_pct: number
  day_change: number
  day_change_pct: number
  xirr: number | null
  allocation: AssetAllocation
}

// =============================================
// Form input types
// =============================================

export interface StockFormData {
  symbol: string
  exchange: Exchange
  quantity: number
  average_price: number
  purchase_date: string
  broker_source: string
}

export interface MFFormData {
  scheme_code: number
  scheme_name: string
  folio_number: string
  units: number
  purchase_nav: number
  fund_type: FundType
  is_sip: boolean
  sip_amount: number
  sip_date: number
}

export interface CryptoFormData {
  coin_id: string
  coin_symbol: string
  quantity: number
  average_price_inr: number
  exchange_source: string
}

export interface FixedIncomeFormData {
  instrument_type: FixedIncomeType
  institution: string
  principal: number
  interest_rate: number
  maturity_date: string
  current_value: number
  nps_equity_pct: number
  notes: string
}

export interface GoldFormData {
  form: GoldForm
  weight_grams: number
  purchase_price_per_gram: number
  units: number
  purchase_nav: number
  notes: string
}
