/**
 * CAS (Consolidated Account Statement) PDF parser.
 * Supports CAMS folio statement and KFintech formats.
 *
 * CAMS format: holdings are in a "SUMMARY OF HOLDINGS" table where all
 * columns are concatenated on one line with no separators:
 *   {scheme_code} {scheme_name}{cost}{units}{dd-Mon-yyyy}{nav}{market_value}
 *
 * KFintech format: holdings are in folio blocks with "Closing Balance" lines.
 */

import pdf from 'pdf-parse'

export interface ParsedMFHolding {
  schemeName: string
  schemeCode: number | null   // null if lookup failed
  isin: string | null         // extracted from CAS statement
  folioNumber: string
  units: number
  purchaseNav: number | null  // computed as investedValue / units
  nav: number | null          // NAV from statement (current as of statement date)
  investedValue: number | null
  fundType: string | null
  purchaseDate: string | null // SIP start date or first transaction date
  isSip: boolean
  sipAmount: number | null    // rounded to nearest integer
}

export interface CASParseResult {
  holdings: ParsedMFHolding[]
  pan: string | null
  statementDate: string | null
  errors: string[]
  _rawText?: string  // only included when holdings = 0, for debugging
}

// ─────────────────────────────────────────────
// Text extraction helpers
// ─────────────────────────────────────────────

function extractPAN(text: string): string | null {
  const m = text.match(/(?:PAN|Tax Payer No|Unit HolderPAN)[/\s:]*([A-Z]{5}[0-9]{4}[A-Z])/i)
  return m ? m[1].toUpperCase() : null
}

function extractStatementDate(text: string): string | null {
  // CAMS: "Statement Date : 25-Feb-2026"
  const m1 = text.match(/Statement\s+Date\s*:\s*(\d{2}-[A-Za-z]{3}-\d{4})/i)
  if (m1) return m1[1]
  // KFintech / others: "as on DD-Mon-YYYY"
  const m2 = text.match(/as\s+on\s+(\d{2}[-/]\w{2,3}[-/]\d{2,4})/i)
  return m2 ? m2[1] : null
}

// ─────────────────────────────────────────────
// CAMS format — SUMMARY OF HOLDINGS table
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// CAMS SIP registration section
// ─────────────────────────────────────────────

interface SIPInfo {
  purchaseDate: string | null
  sipAmount: number | null
}

/**
 * Parses the SIP REGISTRATION section to extract purchase date and SIP amount.
 * Returns a map keyed by a normalised scheme name fragment for fuzzy matching.
 *
 * Line format (all concatenated):
 *   {scheme_name}{dd-Mon-yyyy}{dd-Mon-yyyy}{frequency}{sip_day}{amount}
 * Example:
 *   "SBI Contra Fund - Regular Plan - Growth27-Dec-202321-Dec-2050Once A Month212,500.00"
 */
function extractSIPDetails(text: string): Map<string, SIPInfo> {
  const map = new Map<string, SIPInfo>()

  const sipStart = text.search(/SIP\s+REGISTRATION/i)
  if (sipStart === -1) return map

  const sipSection = text.slice(sipStart, sipStart + 2000)
  const lines = sipSection.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    if (/^(Scheme Name|SIP REGISTRATION|From Date)/i.test(line)) continue

    // Need at least two dates: from-date and to-date
    const dates = [...line.matchAll(/(\d{2}-[A-Za-z]{3}-\d{4})/g)]
    if (dates.length < 2) continue

    const fromDate = dates[0][1]
    const firstDateIdx = line.indexOf(fromDate)
    const schemeName = line.slice(0, firstDateIdx).trim()
    if (!schemeName) continue

    // After frequency keyword: {1-2 digit SIP day}{amount}
    // e.g. "Once A Month212,500.00" → day=21, amount=2,500.00
    const freqMatch = line.match(/(?:Once A Month|Monthly|Quarterly|Annual|Half.?Yearly|Weekly|Daily)\s*(\d{1,2})([\d,]+\.\d{2})/i)
    const sipAmount = freqMatch
      ? Math.round(parseFloat(freqMatch[2].replace(/,/g, '')))
      : (() => { const m = line.match(/([\d,]+\.\d{2})\s*$/); return m ? Math.round(parseFloat(m[1].replace(/,/g, ''))) : null })()

    // Key: normalised first ~20 chars of scheme name for fuzzy lookup
    const key = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    map.set(key, { purchaseDate: fromDate, sipAmount })
  }

  return map
}

function matchSIP(schemeName: string, sipMap: Map<string, SIPInfo>): SIPInfo | null {
  const key = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  // Exact prefix match
  if (sipMap.has(key)) return sipMap.get(key)!
  // Partial match: find any SIP key that shares the first 10 chars
  const prefix = key.slice(0, 10)
  for (const [k, v] of sipMap) {
    if (k.startsWith(prefix)) return v
  }
  return null
}

/**
 * Parses the CAMS "SUMMARY OF HOLDINGS" table.
 * Each data row is all columns concatenated, anchored by a dd-Mon-yyyy date.
 *
 * Row structure:
 *   {scheme_name_with_code}{cost_Rs.}{units}{dd-Mon-yyyy}{nav}{market_value_Rs.}
 *
 * Example:
 *   "L036G SBI Contra Fund-  Regular Plan- Gr67,500.00183.19224-Feb-2026390.628671,559.89"
 *
 * Fund type is inferred from asset class section headings like "EQUITY - 100 %".
 */
function parseCAMSSummary(text: string, sipMap: Map<string, SIPInfo>, isinMap: Map<string, string>): Omit<ParsedMFHolding, 'schemeCode'>[] {
  const results: Omit<ParsedMFHolding, 'schemeCode'>[] = []

  const summaryStart = text.search(/SUMMARY OF HOLDINGS/i)
  if (summaryStart === -1) return results

  const section = text.slice(summaryStart, summaryStart + 4000)
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean)

  const folioMatch = text.match(/FOLIO\s+(?:No|Number)[.:\s]+([A-Za-z0-9/\-]+)/i)
  const folioNumber = folioMatch ? folioMatch[1].trim() : ''

  const assetClassMap: Record<string, string> = {
    equity: 'Equity', debt: 'Debt', hybrid: 'Hybrid',
    liquid: 'Debt', gold: 'Other', other: 'Other',
  }

  // Pre-scan: build list of (lineIndex, fundType) for all asset class headings.
  // In CAMS, the heading can appear BEFORE or AFTER the group of holdings.
  const assetHeadings: Array<{ idx: number; type: string }> = []
  lines.forEach((line, idx) => {
    const m = line.match(/^(EQUITY|DEBT|HYBRID|LIQUID|GOLD|OTHER)\s*[-–]/i)
    if (m) assetHeadings.push({ idx, type: assetClassMap[m[1].toLowerCase()] ?? 'Other' })
  })

  // Assign fund type to a holding line by finding the nearest heading
  function fundTypeForLine(lineIdx: number): string | null {
    if (assetHeadings.length === 0) return null
    // Prefer a heading that comes before this line; fall back to nearest overall
    const before = assetHeadings.filter(h => h.idx <= lineIdx)
    if (before.length > 0) return before[before.length - 1].type
    // Heading is after — pick the closest one
    return assetHeadings.reduce((a, b) =>
      Math.abs(b.idx - lineIdx) < Math.abs(a.idx - lineIdx) ? b : a
    ).type
  }

  for (const [lineIdx, line] of lines.entries()) {
    if (/^(Scheme Name|Statement Date|SUMMARY OF|NAV as on|Unit Balance|Amount|#\s|Total\b)/i.test(line)) continue
    if (/^(EQUITY|DEBT|HYBRID|LIQUID|GOLD|OTHER)\s*[-–]/i.test(line)) continue

    // Anchor on dd-Mon-yyyy date
    const dateMatch = line.match(/(\d{2}-[A-Za-z]{3}-\d{4})/)
    if (!dateMatch) continue

    const dateStr = dateMatch[1]
    const dateIdx = line.indexOf(dateStr)
    const beforeDate = line.slice(0, dateIdx)
    const afterDate = line.slice(dateIdx + dateStr.length)

    const afterMatch = afterDate.match(/^(.*?)([\d,]+\.\d{2})$/)
    if (!afterMatch) continue
    const nav = parseFloat(afterMatch[1].replace(/,/g, ''))
    if (isNaN(nav) || nav <= 0) continue

    const beforeMatch = beforeDate.match(/^(.*[A-Za-z -])([\d,]+\.\d{2})([\d,]+\.\d{3,})$/)
    if (!beforeMatch) continue

    let schemeName = beforeMatch[1].trim()
    const investedValue = parseFloat(beforeMatch[2].replace(/,/g, ''))
    const units = parseFloat(beforeMatch[3].replace(/,/g, ''))

    if (isNaN(units) || units <= 0 || isNaN(investedValue)) continue

    schemeName = schemeName.replace(/^[A-Z]\d{3,4}[A-Z]\s+/, '').trim()
    schemeName = schemeName.replace(/\s*-\s*Payout of IDCW.*$/i, '').trim()

    const purchaseNav = (investedValue && units) ? investedValue / units : null
    const sip = matchSIP(schemeName, sipMap)
    const isin = matchISIN(schemeName, isinMap)

    results.push({
      schemeName,
      isin,
      folioNumber,
      units,
      purchaseNav,
      nav,
      investedValue,
      fundType: fundTypeForLine(lineIdx),
      purchaseDate: sip?.purchaseDate ?? null,
      isSip: sip !== null,
      sipAmount: sip?.sipAmount ?? null,
    })
  }

  return results
}

// ─────────────────────────────────────────────
// KFintech / legacy format — folio blocks
// ─────────────────────────────────────────────

function splitIntoFolioBlocks(text: string): string[] {
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalised.split(/(?=Folio\s+(?:No|Number)[.:]?\s)/i)
  return blocks.filter((b) => b.trim().length > 0)
}

function parseFolioBlock(block: string): Omit<ParsedMFHolding, 'schemeCode'> | null {
  const folioMatch = block.match(/Folio\s+(?:No|Number)[.:]?\s*([A-Za-z0-9/\-]+)/i)
  if (!folioMatch) return null
  const folioNumber = folioMatch[1].trim()

  let schemeName = ''
  const schemeMatch = block.match(/Scheme\s*:\s*(.+?)(?:\s*\(ISIN|\n|$)/i)
  if (schemeMatch) {
    schemeName = schemeMatch[1].trim()
  } else {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const fundLine = lines.find(
      (l) => /fund|scheme|plan/i.test(l) && l.length > 15 && !/folio/i.test(l),
    )
    if (fundLine) schemeName = fundLine
  }
  if (!schemeName) return null

  schemeName = schemeName
    .replace(/\s*-\s*Payout of IDCW.*$/i, '')
    .replace(/\s*-\s*Reinvestment.*$/i, '')
    .trim()

  const closingMatch = block.match(
    /Closing\s+(?:Unit\s+)?Balance[:\s]+[\d\-\w]+\s+([\d,]+\.?\d*)\s+Units?/i,
  )
  if (!closingMatch) return null
  const units = parseFloat(closingMatch[1].replace(/,/g, ''))
  if (isNaN(units) || units <= 0) return null

  let nav: number | null = null
  const navAtMatch = block.match(/Units?\s+@\s+([\d,]+\.?\d*)/i)
  if (navAtMatch) {
    nav = parseFloat(navAtMatch[1].replace(/,/g, ''))
  } else {
    const navMatch = block.match(/NAV\s+(?:on|as\s+on)[^:]*:\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i)
    if (navMatch) nav = parseFloat(navMatch[1].replace(/,/g, ''))
  }

  let investedValue: number | null = null
  const valueMatch = block.match(/(?:Market\s+Value|Current\s+Value)[^\d]*([\d,]+\.?\d*)/i)
  if (valueMatch) {
    investedValue = parseFloat(valueMatch[1].replace(/,/g, ''))
  } else if (nav !== null) {
    investedValue = units * nav
  }

  const isinMatch = block.match(/ISIN\s*[:\-]\s*(INF[A-Z0-9]{9})/i)
  const isin = isinMatch ? isinMatch[1] : null
  const purchaseNav = (investedValue && units) ? investedValue / units : null
  return { schemeName, isin, folioNumber, units, purchaseNav, nav, investedValue, fundType: null, purchaseDate: null, isSip: false, sipAmount: null }
}

// ─────────────────────────────────────────────
// AMFI NAVAll.txt — ISIN → scheme code lookup
// ─────────────────────────────────────────────

let amfiISINCache: Map<string, number> | null = null

async function getAMFIISINMap(): Promise<Map<string, number>> {
  if (amfiISINCache) return amfiISINCache
  try {
    const res = await fetch('https://portal.amfiindia.com/spages/NAVAll.txt', {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return new Map()
    const text = await res.text()
    const map = new Map<string, number>()
    for (const line of text.split('\n')) {
      const parts = line.split(';')
      if (parts.length < 3) continue
      const code = parseInt(parts[0].trim())
      if (isNaN(code)) continue
      const isin1 = parts[1]?.trim()
      const isin2 = parts[2]?.trim()
      if (isin1 && isin1 !== '-') map.set(isin1, code)
      if (isin2 && isin2 !== '-') map.set(isin2, code)
    }
    amfiISINCache = map
    return map
  } catch {
    return new Map()
  }
}

async function lookupSchemeCode(isin: string | null, schemeName: string): Promise<number | null> {
  // 1. ISIN → exact match via AMFI (most reliable)
  if (isin) {
    const isinMap = await getAMFIISINMap()
    const code = isinMap.get(isin)
    if (code) return code
  }

  // 2. Name search via mfapi.in as fallback
  try {
    const query = encodeURIComponent(schemeName.slice(0, 60))
    const res = await fetch(`${process.env.MFAPI_BASE_URL}/mf/search?q=${query}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const results: Array<{ schemeCode: number; schemeName: string }> = await res.json()
    if (!results.length) return null
    const lower = schemeName.toLowerCase()
    const exact = results.find((r) => r.schemeName.toLowerCase().includes(lower.slice(0, 30)))
    return (exact ?? results[0]).schemeCode
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// Extract ISINs from CAS text
// ─────────────────────────────────────────────

/**
 * Scans the full CAS text for ISIN mentions near scheme names.
 * Returns a map of normalised scheme name prefix → ISIN.
 *
 * Handles patterns like:
 *   "SBI Contra Fund - Regular Plan\nISIN : INF200K01LM0"
 *   "SBI Contra Fund (ISIN: INF200K01LM0)"
 */
function extractISINMap(text: string): Map<string, string> {
  const map = new Map<string, string>() // normalised name prefix → ISIN

  // Inline: "Scheme Name (ISIN: INFxxx)"
  for (const m of text.matchAll(/([A-Za-z0-9 \-&'.]+(?:Fund|Plan|Scheme|Growth|IDCW)[^\n(]*)\s*\(ISIN\s*[:\-]\s*(INF[A-Z0-9]{9})\)/gi)) {
    const key = m[1].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    map.set(key, m[2])
  }

  // Separate line: "...\nISIN : INFxxx" — look back up to 120 chars for a scheme name
  for (const m of text.matchAll(/ISIN\s*[:\-]\s*(INF[A-Z0-9]{9})/gi)) {
    const isin = m[1]
    const before = text.slice(Math.max(0, m.index! - 120), m.index!)
    const nameMatch = before.match(/([A-Za-z0-9 \-&'.]+(?:Fund|Plan|Scheme|Growth|IDCW)[^\n]*)[\n\r]*$/i)
    if (nameMatch) {
      const key = nameMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
      if (!map.has(key)) map.set(key, isin)
    }
  }

  return map
}

function matchISIN(schemeName: string, isinMap: Map<string, string>): string | null {
  const key = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  if (isinMap.has(key)) return isinMap.get(key)!
  const prefix = key.slice(0, 12)
  for (const [k, v] of isinMap) {
    if (k.startsWith(prefix)) return v
  }
  return null
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

export async function parseCASPDF(buffer: Buffer): Promise<CASParseResult> {
  const errors: string[] = []
  let text = ''

  try {
    const parsed = await pdf(buffer)
    text = parsed.text
  } catch (e) {
    return { holdings: [], pan: null, statementDate: null, errors: ['Failed to read PDF: ' + String(e)] }
  }

  const pan = extractPAN(text)
  const statementDate = extractStatementDate(text)

  const sipMap = extractSIPDetails(text)
  const isinMap = extractISINMap(text)

  // Try CAMS summary table format first
  let rawHoldings = parseCAMSSummary(text, sipMap, isinMap)

  // Fall back to KFintech folio-block format
  if (rawHoldings.length === 0) {
    const blocks = splitIntoFolioBlocks(text)
    for (const block of blocks) {
      const h = parseFolioBlock(block)
      if (h) rawHoldings.push(h)
      else if (block.length > 100) {
        errors.push(`Could not parse folio block: ${block.slice(0, 80).replace(/\n/g, ' ')}`)
      }
    }
  }

  // Look up scheme codes in parallel (ISIN-first via AMFI, then name fallback)
  const holdings = await Promise.all(
    rawHoldings.map(async (h) => ({
      ...h,
      schemeCode: await lookupSchemeCode(h.isin ?? null, h.schemeName),
    })),
  )

  return {
    holdings,
    pan,
    statementDate,
    errors,
    ...(holdings.length === 0 ? { _rawText: text.slice(0, 3000) } : {}),
  }
}
