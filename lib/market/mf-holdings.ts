import { supabaseAdmin } from '@/lib/supabase/admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const STALE_DAYS = 30

export interface UnderlyingHolding {
  rank: number
  name: string
  isin: string | null
  pct: number
}

export interface SchemeInfo {
  scheme_code: number
  scheme_name: string
  scheme_category: string
  fund_house: string
}

export async function getMFSchemeInfo(schemeCode: number): Promise<SchemeInfo | null> {
  try {
    const res = await fetch(`${process.env.MFAPI_BASE_URL}/mf/${schemeCode}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.meta
    if (!meta) return null
    return {
      scheme_code: schemeCode,
      scheme_name: meta.scheme_name,
      scheme_category: meta.scheme_category ?? '',
      fund_house: meta.fund_house ?? '',
    }
  } catch {
    return null
  }
}

export function isEquityScheme(schemeCategory: string): boolean {
  const c = schemeCategory.toUpperCase()
  return c.includes('EQUITY') || c.includes('ELSS')
}

export async function getMFUnderlyingHoldings(info: SchemeInfo): Promise<UnderlyingHolding[]> {
  if (!isEquityScheme(info.scheme_category)) return []

  // Check DB for fresh data
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - STALE_DAYS)

  const { data: existing } = await supabaseAdmin
    .from('mf_underlying_holdings')
    .select('stock_name, stock_isin, weight_pct')
    .eq('scheme_code', info.scheme_code)
    .gte('as_of_date', cutoff.toISOString().split('T')[0])
    .order('weight_pct', { ascending: false })

  if (existing && existing.length > 0) {
    return existing.map((h, i) => ({
      rank: i + 1,
      name: h.stock_name,
      isin: h.stock_isin,
      pct: Number(h.weight_pct),
    }))
  }

  // Generate via Gemini
  const holdings = await generateHoldingsViaGemini(info)
  if (holdings.length === 0) return []

  // Persist — delete old rows first, then insert
  await supabaseAdmin
    .from('mf_underlying_holdings')
    .delete()
    .eq('scheme_code', info.scheme_code)

  const today = new Date().toISOString().split('T')[0]
  await supabaseAdmin.from('mf_underlying_holdings').insert(
    holdings.map(h => ({
      scheme_code: info.scheme_code,
      stock_name: h.name,
      stock_isin: h.isin ?? null,
      weight_pct: h.pct,
      as_of_date: today,
    }))
  )

  return holdings
}

async function generateHoldingsViaGemini(info: SchemeInfo): Promise<UnderlyingHolding[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `List the top 20 equity stock holdings for this Indian mutual fund based on the most recent publicly available portfolio disclosure.

Fund: ${info.scheme_name}
Category: ${info.scheme_category}
AMC: ${info.fund_house}

Return ONLY a valid JSON array with no markdown, no explanation, no code fences:
[{"rank":1,"name":"Company Name","isin":"INE000A00000","pct":8.5},...]

Rules:
- Equity holdings only — no cash, bonds, REITs, derivatives
- Use the exact company name as listed on NSE/BSE
- pct is the percentage of total AUM
- Include ISIN only where you are confident; otherwise use null
- Percentages for top 20 typically sum to 50–85%`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0]) as UnderlyingHolding[]
    return parsed
      .filter(h => h.name && typeof h.pct === 'number' && h.pct > 0)
      .slice(0, 20)
  } catch {
    return []
  }
}

export interface PairOverlap {
  pct: number
  common: { name: string; pctA: number; pctB: number }[]
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+ltd\.?$/i, '')
    .replace(/\s+limited\.?$/i, '')
    .replace(/\s+industries\.?$/i, '')
    .replace(/[.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function computeOverlap(
  holdingsA: UnderlyingHolding[],
  holdingsB: UnderlyingHolding[],
): PairOverlap {
  // Build two lookup maps for B — by ISIN (preferred) and by normalised name
  const isinMapB = new Map(holdingsB.filter(h => h.isin).map(h => [h.isin!, h]))
  const nameMapB = new Map(holdingsB.map(h => [normaliseName(h.name), h]))

  let overlap = 0
  const common: { name: string; pctA: number; pctB: number }[] = []

  for (const h of holdingsA) {
    const matchB = (h.isin ? isinMapB.get(h.isin) : undefined) ?? nameMapB.get(normaliseName(h.name))
    if (matchB) {
      overlap += Math.min(h.pct, matchB.pct)
      common.push({ name: h.name, pctA: h.pct, pctB: matchB.pct })
    }
  }

  return {
    pct: Math.round(overlap * 10) / 10,
    common: common.sort((a, b) => Math.min(b.pctA, b.pctB) - Math.min(a.pctA, a.pctB)),
  }
}
