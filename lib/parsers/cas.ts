/**
 * CAS / MF Statement PDF parser.
 *
 * Parsers tried in order:
 *   1. CAMS "SUMMARY OF HOLDINGS" table
 *   2. MF Central (similar to CAMS, different header)
 *   3. KFintech folio-block format
 *   4. AMC transaction statement (e.g. Canara Robeco)
 *   5. Generic tabular (Zerodha Coin, Groww, ET Money, etc.)
 *   6. AI format identification → pattern-guided extraction (last resort)
 *
 * Scheme code lookup:
 *   1. ISIN → AMFI exact match  ← mandatory when ISIN is present
 *   2. Normalised name → AMFI fuzzy match (fallback, no external API)
 */

import pdf from 'pdf-parse'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ParsedMFHolding {
  schemeName: string
  schemeCode: number | null
  isin: string | null
  folioNumber: string
  units: number
  purchaseNav: number | null
  nav: number | null
  investedValue: number | null
  fundType: string | null
  purchaseDate: string | null
  isSip: boolean
  sipAmount: number | null
}

export interface CASParseResult {
  holdings: ParsedMFHolding[]
  pan: string | null
  statementDate: string | null
  errors: string[]
  _rawText?: string
}

// ─────────────────────────────────────────────
// AMFI data — single fetch, dual-purpose cache
// ─────────────────────────────────────────────

interface AMFIEntry {
  code: number
  name: string
  normalised: string
}

interface AMFIData {
  isinToCode: Map<string, number>
  entries: AMFIEntry[]
}

let amfiCache: AMFIData | null = null

async function getAMFIData(): Promise<AMFIData> {
  if (amfiCache) return amfiCache
  try {
    const res = await fetch('https://portal.amfiindia.com/spages/NAVAll.txt', {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { isinToCode: new Map(), entries: [] }
    const text = await res.text()

    const isinToCode = new Map<string, number>()
    const entries: AMFIEntry[] = []

    for (const line of text.split('\n')) {
      const parts = line.split(';')
      if (parts.length < 5) continue
      const code = parseInt(parts[0].trim())
      if (isNaN(code)) continue

      const isin1 = parts[1]?.trim()
      const isin2 = parts[2]?.trim()
      const name  = parts[3]?.trim() ?? ''

      if (isin1 && isin1 !== '-') isinToCode.set(isin1, code)
      if (isin2 && isin2 !== '-') isinToCode.set(isin2, code)

      if (name) entries.push({ code, name, normalised: normaliseForMatch(name) })
    }

    amfiCache = { isinToCode, entries }
    return amfiCache
  } catch {
    return { isinToCode: new Map(), entries: [] }
  }
}

// ─────────────────────────────────────────────
// Scheme code lookup
// ─────────────────────────────────────────────

function normaliseForMatch(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fund|plan|scheme|option|payout|growth|idcw|dividend|direct|regular|reinvestment)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function lookupSchemeCode(isin: string | null, schemeName: string): Promise<number | null> {
  const data = await getAMFIData()

  // 1. ISIN exact match — required when ISIN is present
  if (isin) {
    const code = data.isinToCode.get(isin)
    if (code) return code
    // ISIN provided but not found → don't guess via name
    return null
  }

  // 2. No ISIN — fuzzy name match against AMFI list
  if (!schemeName || !data.entries.length) return null

  const query = normaliseForMatch(schemeName)
  const queryWords = query.split(' ').filter(w => w.length > 2)
  if (queryWords.length === 0) return null

  let bestScore = 0
  let bestCode: number | null = null

  for (const entry of data.entries) {
    let score = 0
    for (const word of queryWords) {
      if (entry.normalised.includes(word)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCode = entry.code
    }
  }

  // Need at least 60 % of query words to match
  const threshold = Math.ceil(queryWords.length * 0.6)
  return bestScore >= threshold ? bestCode : null
}

// ─────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────

function extractPAN(text: string): string | null {
  const m = text.match(/(?:PAN|Tax Payer No|Unit HolderPAN)[/\s:]*([A-Z]{5}[0-9]{4}[A-Z])/i)
  return m ? m[1].toUpperCase() : null
}

function extractStatementDate(text: string): string | null {
  const m1 = text.match(/Statement\s+Date\s*:\s*(\d{2}-[A-Za-z]{3}-\d{4})/i)
  if (m1) return m1[1]
  const m2 = text.match(/Statement\s+Date\s*:\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i)
  if (m2) return m2[1]
  const m3 = text.match(/as\s+on\s+(\d{2}[-/]\w{2,3}[-/]\d{2,4})/i)
  return m3 ? m3[1] : null
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

// ─────────────────────────────────────────────
// ISIN map from text
// ─────────────────────────────────────────────

function extractISINMap(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of text.matchAll(/([A-Za-z0-9 \-&'.]+(?:Fund|Plan|Scheme|Growth|IDCW)[^\n(]*)\s*\(ISIN\s*[:\-]\s*(INF[A-Z0-9]{9})\)/gi)) {
    const key = m[1].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    map.set(key, m[2])
  }
  for (const m of text.matchAll(/ISIN\s*[:\-]\s*(INF[A-Z0-9]{9})/gi)) {
    const isin   = m[1]
    const before = text.slice(Math.max(0, m.index! - 120), m.index!)
    const nm     = before.match(/([A-Za-z0-9 \-&'.]+(?:Fund|Plan|Scheme|Growth|IDCW)[^\n]*)[\n\r]*$/i)
    if (nm) {
      const key = nm[1].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
      if (!map.has(key)) map.set(key, isin)
    }
  }
  return map
}

function matchISIN(schemeName: string, isinMap: Map<string, string>): string | null {
  const key    = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  if (isinMap.has(key)) return isinMap.get(key)!
  const prefix = key.slice(0, 12)
  for (const [k, v] of isinMap) {
    if (k.startsWith(prefix)) return v
  }
  return null
}

// ─────────────────────────────────────────────
// SIP info extraction
// ─────────────────────────────────────────────

interface SIPInfo { purchaseDate: string | null; sipAmount: number | null }

function extractSIPDetails(text: string): Map<string, SIPInfo> {
  const map = new Map<string, SIPInfo>()
  const sipStart = text.search(/SIP\s+REGISTRATION/i)
  if (sipStart === -1) return map

  const sipSection = text.slice(sipStart, sipStart + 2000)
  for (const line of sipSection.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (/^(Scheme Name|SIP REGISTRATION|From Date)/i.test(line)) continue
    const dates = [...line.matchAll(/(\d{2}-[A-Za-z]{3}-\d{4})/g)]
    if (dates.length < 2) continue
    const fromDate = dates[0][1]
    const schemeName = line.slice(0, line.indexOf(fromDate)).trim()
    if (!schemeName) continue
    const freqMatch = line.match(/(?:Once A Month|Monthly|Quarterly|Annual|Half.?Yearly|Weekly|Daily)\s*(\d{1,2})([\d,]+\.\d{2})/i)
    const sipAmount = freqMatch
      ? Math.round(parseNum(freqMatch[2]))
      : (() => { const m = line.match(/([\d,]+\.\d{2})\s*$/); return m ? Math.round(parseNum(m[1])) : null })()
    const key = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    map.set(key, { purchaseDate: fromDate, sipAmount })
  }
  return map
}

function matchSIP(schemeName: string, sipMap: Map<string, SIPInfo>): SIPInfo | null {
  const key = schemeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  if (sipMap.has(key)) return sipMap.get(key)!
  const prefix = key.slice(0, 10)
  for (const [k, v] of sipMap) {
    if (k.startsWith(prefix)) return v
  }
  return null
}

// ─────────────────────────────────────────────
// 1. CAMS "SUMMARY OF HOLDINGS"
// ─────────────────────────────────────────────

function parseCAMSSummary(text: string, sipMap: Map<string, SIPInfo>, isinMap: Map<string, string>): Omit<ParsedMFHolding, 'schemeCode'>[] {
  const results: Omit<ParsedMFHolding, 'schemeCode'>[] = []
  const summaryStart = text.search(/SUMMARY OF HOLDINGS/i)
  if (summaryStart === -1) return results

  const section = text.slice(summaryStart, summaryStart + 4000)
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean)

  const folioMatch = text.match(/FOLIO\s+(?:No|Number)[.:\s]+([A-Za-z0-9/\-]+)/i)
  const folioNumber = folioMatch ? folioMatch[1].trim() : ''

  const assetClassMap: Record<string, string> = { equity: 'Equity', debt: 'Debt', hybrid: 'Hybrid', liquid: 'Debt', gold: 'Other', other: 'Other' }
  const assetHeadings: Array<{ idx: number; type: string }> = []
  lines.forEach((line, idx) => {
    const m = line.match(/^(EQUITY|DEBT|HYBRID|LIQUID|GOLD|OTHER)\s*[-–]/i)
    if (m) assetHeadings.push({ idx, type: assetClassMap[m[1].toLowerCase()] ?? 'Other' })
  })

  function fundTypeForLine(lineIdx: number): string | null {
    if (!assetHeadings.length) return null
    const before = assetHeadings.filter(h => h.idx <= lineIdx)
    if (before.length > 0) return before[before.length - 1].type
    return assetHeadings.reduce((a, b) => Math.abs(b.idx - lineIdx) < Math.abs(a.idx - lineIdx) ? b : a).type
  }

  for (const [lineIdx, line] of lines.entries()) {
    if (/^(Scheme Name|Statement Date|SUMMARY OF|NAV as on|Unit Balance|Amount|#\s|Total\b)/i.test(line)) continue
    if (/^(EQUITY|DEBT|HYBRID|LIQUID|GOLD|OTHER)\s*[-–]/i.test(line)) continue

    const dateMatch = line.match(/(\d{2}-[A-Za-z]{3}-\d{4})/)
    if (!dateMatch) continue
    const dateStr  = dateMatch[1]
    const dateIdx  = line.indexOf(dateStr)
    const before   = line.slice(0, dateIdx)
    const after    = line.slice(dateIdx + dateStr.length)

    const afterMatch = after.match(/^(.*?)([\d,]+\.\d{2})$/)
    if (!afterMatch) continue
    const nav = parseNum(afterMatch[1])
    if (isNaN(nav) || nav <= 0) continue

    const beforeMatch = before.match(/^(.*[A-Za-z -])([\d,]+\.\d{2})([\d,]+\.\d{3,})$/)
    if (!beforeMatch) continue

    let schemeName   = beforeMatch[1].trim().replace(/^[A-Z]\d{3,4}[A-Z]\s+/, '').replace(/\s*-\s*Payout of IDCW.*$/i, '').trim()
    const investedValue = parseNum(beforeMatch[2])
    const units         = parseNum(beforeMatch[3])
    if (isNaN(units) || units <= 0 || isNaN(investedValue)) continue

    const purchaseNav = investedValue && units ? investedValue / units : null
    const sip  = matchSIP(schemeName, sipMap)
    const isin = matchISIN(schemeName, isinMap)

    results.push({ schemeName, isin, folioNumber, units, purchaseNav, nav, investedValue, fundType: fundTypeForLine(lineIdx), purchaseDate: sip?.purchaseDate ?? null, isSip: sip !== null, sipAmount: sip?.sipAmount ?? null })
  }
  return results
}

// ─────────────────────────────────────────────
// 2. MF Central — delegates to CAMS parser
//    (CAMS operates mfcentral.com; same table structure)
// ─────────────────────────────────────────────

function parseMFCentral(text: string, sipMap: Map<string, SIPInfo>, isinMap: Map<string, string>): Omit<ParsedMFHolding, 'schemeCode'>[] {
  if (!/MF\s*Central|mfcentral\.com|Mutual Fund Central/i.test(text)) return []
  return parseCAMSSummary(text, sipMap, isinMap)
}

// ─────────────────────────────────────────────
// 3. KFintech folio-block format
// ─────────────────────────────────────────────

function parseFolioBlock(block: string): Omit<ParsedMFHolding, 'schemeCode'> | null {
  const folioMatch = block.match(/Folio\s+(?:No|Number)[.:]?\s*([A-Za-z0-9/\-]+)/i)
  if (!folioMatch) return null
  const folioNumber = folioMatch[1].trim()

  let schemeName = ''
  const schemeMatch = block.match(/Scheme\s*:\s*(.+?)(?:\s*\(ISIN|\n|$)/i)
  if (schemeMatch) {
    schemeName = schemeMatch[1].trim()
  } else {
    const fundLine = block.split('\n').map(l => l.trim()).filter(Boolean)
      .find(l => /fund|scheme|plan/i.test(l) && l.length > 15 && !/folio/i.test(l))
    if (fundLine) schemeName = fundLine
  }
  if (!schemeName) return null

  schemeName = schemeName.replace(/\s*-\s*Payout of IDCW.*$/i, '').replace(/\s*-\s*Reinvestment.*$/i, '').trim()

  const closingMatch = block.match(/Closing\s+(?:Unit\s+)?Balance[:\s]+[\d\-\w]+\s+([\d,]+\.?\d*)\s+Units?/i)
  if (!closingMatch) return null
  const units = parseNum(closingMatch[1])
  if (isNaN(units) || units <= 0) return null

  let nav: number | null = null
  const navAtMatch = block.match(/Units?\s+@\s+([\d,]+\.?\d*)/i)
  if (navAtMatch) nav = parseNum(navAtMatch[1])
  else {
    const navMatch = block.match(/NAV\s+(?:on|as\s+on)[^:]*:\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i)
    if (navMatch) nav = parseNum(navMatch[1])
  }

  let investedValue: number | null = null
  const valueMatch = block.match(/(?:Market\s+Value|Current\s+Value)[^\d]*([\d,]+\.?\d*)/i)
  if (valueMatch) investedValue = parseNum(valueMatch[1])
  else if (nav !== null) investedValue = units * nav

  const isinMatch = block.match(/ISIN\s*[:\-]\s*(INF[A-Z0-9]{9})/i)
  const isin = isinMatch ? isinMatch[1] : null
  const purchaseNav = investedValue && units ? investedValue / units : null

  return { schemeName, isin, folioNumber, units, purchaseNav, nav, investedValue, fundType: null, purchaseDate: null, isSip: false, sipAmount: null }
}

function parseKFintechFolioBlocks(text: string, errors: string[]): Omit<ParsedMFHolding, 'schemeCode'>[] {
  const results: Omit<ParsedMFHolding, 'schemeCode'>[] = []
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalised.split(/(?=Folio\s+(?:No|Number)[.:]?\s)/i).filter(b => b.trim().length > 0)
  for (const block of blocks) {
    const h = parseFolioBlock(block)
    if (h) results.push(h)
    else if (block.length > 100) errors.push(`Could not parse folio block: ${block.slice(0, 80).replace(/\n/g, ' ')}`)
  }
  return results
}

// ─────────────────────────────────────────────
// 4. AMC transaction statement
//    (Canara Robeco / KFintech AMC format)
// ─────────────────────────────────────────────

function convertDMYToMon(dmy: string): string | null {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const mon = MONTHS[parseInt(m[2]) - 1]
  return mon ? `${m[1]}-${mon}-${m[3]}` : null
}

function parseAMCTransactionStatement(text: string): Omit<ParsedMFHolding, 'schemeCode'>[] {
  if (!/\([A-Z]{2,6}\)\s*-\s*ISIN\s*:/i.test(text)) return []
  const results: Omit<ParsedMFHolding, 'schemeCode'>[] = []

  const folioMatch = text.match(/(\d{8,})\s*\n?\(Non Transferable\)/i)
  const folioNumber = folioMatch ? folioMatch[1].trim() : ''

  const sipByCode = new Map<string, { purchaseDate: string | null; sipAmount: number | null }>()
  const sipSection = text.match(/SIP\/STP\/SWP Registration Summary([\s\S]*?)(?=\nFolio|\nKYC|$)/i)
  if (sipSection) {
    for (const m of sipSection[1].matchAll(/Live\s+SIP\s*([A-Z]{2,6})\s*\n(\d{2}\/\d{2}\/\d{4})\s*\n\d{2}\/\d{2}\/\d{4}\s*\n([\d,]+)\s*\nMonthly/gi)) {
      sipByCode.set(m[1], { purchaseDate: convertDMYToMon(m[2]), sipAmount: parseInt(m[3].replace(/,/g, '')) })
    }
  }

  const schemeHeaderRegex = /^(.+?)\s*\(([A-Z]{2,6})\)\s*-\s*ISIN\s*:\s*(INF[A-Z0-9]{9})/gm
  const schemes: Array<{ name: string; code: string; isin: string; startIdx: number }> = []
  let m
  while ((m = schemeHeaderRegex.exec(text)) !== null) {
    schemes.push({ name: m[1].trim(), code: m[2], isin: m[3], startIdx: m.index })
  }
  if (!schemes.length) return []

  for (let i = 0; i < schemes.length; i++) {
    const { name, code, isin, startIdx } = schemes[i]
    const endIdx = i + 1 < schemes.length ? schemes[i + 1].startIdx : text.length
    const block  = text.slice(startIdx, endIdx)

    const unitsMatch = block.match(/([\d,]+\.\d{3})\n+(?:[\d,]+\.\d*\n+)*Lock Free Units\s*:/i)
    if (!unitsMatch) continue
    const units = parseNum(unitsMatch[1])
    if (isNaN(units) || units <= 0) continue

    const costMatch = block.match(/Cost Value\s*:\s*([\d,]+\.?\d*)/i)
    const investedValue = costMatch ? parseNum(costMatch[1]) : null

    const navMatch = block.match(/NAV\s*:\s*\([^)]*\)\s*([\d,]+\.?\d*)\s*\(as on/i)
    const nav = navMatch ? parseNum(navMatch[1]) : null

    const purchaseNav = investedValue && units ? investedValue / units : null
    const sip = sipByCode.get(code) ?? null

    results.push({ schemeName: name, isin, folioNumber, units, purchaseNav, nav, investedValue, fundType: null, purchaseDate: sip?.purchaseDate ?? null, isSip: sip !== null, sipAmount: sip?.sipAmount ?? null })
  }
  return results
}

// ─────────────────────────────────────────────
// 5. Generic tabular — broker exports
//    (Zerodha Coin, Groww, ET Money, Paytm Money, etc.)
//
//    Strategy A: header row detected → column-based
//    Strategy B: no header → heuristic line-by-line
// ─────────────────────────────────────────────

function parseGenericTabular(text: string): Omit<ParsedMFHolding, 'schemeCode'>[] {
  const results: Omit<ParsedMFHolding, 'schemeCode'>[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Strategy A: find a header row with scheme + units + nav columns
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const l = lines[i].toLowerCase()
    if ((l.includes('scheme') || l.includes('fund name')) && l.includes('unit') && (l.includes('nav') || l.includes('value'))) {
      headerIdx = i
      break
    }
  }

  if (headerIdx !== -1) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      if (/^(total|grand|net|subtotal|portfolio value)/i.test(line)) break
      if (!/fund|plan|scheme|growth|direct|regular|elss|index/i.test(line)) continue

      const nums = [...line.matchAll(/([\d,]+\.?\d*)/g)]
        .map(m => parseNum(m[1]))
        .filter(n => !isNaN(n) && n > 0)
      if (nums.length < 2) continue

      const nameMatch = line.match(/^([A-Za-z][A-Za-z0-9 \-&'.()+]+?)(?=\s{2,}|\t|[\d])/)
      if (!nameMatch || nameMatch[1].trim().length < 10) continue

      const schemeName = nameMatch[1].trim()
      // Units tend to have 3 decimal places; value is the largest number
      const unitsLike = nums.find(n => { const s = n.toFixed(10); return s.indexOf('.') !== -1 && s.split('.')[1].replace(/0+$/, '').length >= 3 }) ?? nums[0]
      const value = Math.max(...nums)
      const investedValue = value > unitsLike ? value : null
      const isinMatch = line.match(/(INF[A-Z0-9]{9})/i)

      if (unitsLike <= 0) continue
      results.push({ schemeName, isin: isinMatch?.[1] ?? null, folioNumber: '', units: unitsLike, purchaseNav: investedValue && unitsLike ? investedValue / unitsLike : null, nav: null, investedValue, fundType: null, purchaseDate: null, isSip: false, sipAmount: null })
    }
    if (results.length > 0) return results
  }

  // Strategy B: heuristic — each line with a fund keyword + ≥2 numbers
  for (const line of lines) {
    if (/^(scheme|fund|folio|total|net|grand|portfolio|as on|date|sl\.?\s*no|name)/i.test(line)) continue
    if (!/fund|plan|scheme|growth|direct|regular|elss|index/i.test(line)) continue

    const nums = [...line.matchAll(/([\d,]+\.?\d*)/g)]
      .map(m => parseNum(m[1]))
      .filter(n => !isNaN(n) && n > 0)
    if (nums.length < 2) continue

    const nameMatch = line.match(/^([A-Za-z][A-Za-z0-9 \-&'.()+]+?)(?=\s{2,}|\t|[\d])/)
    if (!nameMatch || nameMatch[1].trim().length < 10) continue

    const schemeName = nameMatch[1].trim()
    const unitsLike = nums.find(n => { const s = n.toFixed(10); return s.indexOf('.') !== -1 && s.split('.')[1].replace(/0+$/, '').length >= 3 }) ?? nums[0]
    const value = Math.max(...nums)
    const investedValue = value > unitsLike ? value : null
    const isinMatch = line.match(/(INF[A-Z0-9]{9})/i)

    if (unitsLike <= 0) continue
    results.push({ schemeName, isin: isinMatch?.[1] ?? null, folioNumber: '', units: unitsLike, purchaseNav: investedValue && unitsLike ? investedValue / unitsLike : null, nav: null, investedValue, fundType: null, purchaseDate: null, isSip: false, sipAmount: null })
  }

  return results
}

// ─────────────────────────────────────────────
// 6. AI format identification (last resort)
//    Sends only the first ~1200 chars to Gemini.
//    Gemini returns regex patterns → we apply them.
// ─────────────────────────────────────────────

interface AIFormatHint {
  platform: string
  fundSeparatorPattern: string
  nameCapture: string
  unitsCapture: string
  navCapture: string
  investedCapture: string
  isinCapture: string
  folioCapture: string
}

async function identifyFormatWithAI(textSample: string): Promise<AIFormatHint | null> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `This is raw text extracted from an Indian mutual fund statement PDF.
Analyse the structure and return regex patterns to extract holdings.

TEXT SAMPLE (first ~1200 chars):
${textSample}

Reply with ONLY valid JSON (no markdown fences):
{
  "platform": "CAMS|KFintech|MFCentral|ZerodhaCoin|Groww|ETMoney|PaytmMoney|Other",
  "fundSeparatorPattern": "regex that splits text into one block per fund (empty string if each fund is one line)",
  "nameCapture": "regex with capture group 1 = scheme/fund name",
  "unitsCapture": "regex with capture group 1 = units held (number)",
  "navCapture": "regex with capture group 1 = current NAV (number), or empty string",
  "investedCapture": "regex with capture group 1 = invested/cost value (number), or empty string",
  "isinCapture": "regex with capture group 1 = ISIN (INFxxxxxxxxx), or empty string",
  "folioCapture": "regex with capture group 1 = folio number, or empty string"
}`

    const raw  = (await model.generateContent(prompt)).response.text().trim()
    const json = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
    return JSON.parse(json) as AIFormatHint
  } catch {
    return null
  }
}

function parseWithAIHints(text: string, hints: AIFormatHint): Omit<ParsedMFHolding, 'schemeCode'>[] {
  const results: Omit<ParsedMFHolding, 'schemeCode'>[] = []
  try {
    const blocks = hints.fundSeparatorPattern
      ? text.split(new RegExp(hints.fundSeparatorPattern, 'gi')).filter(b => b.trim().length > 50)
      : text.split('\n').filter(l => l.trim().length > 30) // line-per-fund mode

    const nameRe     = hints.nameCapture     ? new RegExp(hints.nameCapture, 'i')     : null
    const unitsRe    = hints.unitsCapture    ? new RegExp(hints.unitsCapture, 'i')    : null
    const navRe      = hints.navCapture      ? new RegExp(hints.navCapture, 'i')      : null
    const investedRe = hints.investedCapture ? new RegExp(hints.investedCapture, 'i') : null
    const isinRe     = hints.isinCapture     ? new RegExp(hints.isinCapture, 'i')     : null
    const folioRe    = hints.folioCapture    ? new RegExp(hints.folioCapture, 'i')    : null

    if (!nameRe || !unitsRe) return []

    for (const block of blocks) {
      const nameMatch  = block.match(nameRe)
      const unitsMatch = block.match(unitsRe)
      if (!nameMatch?.[1] || !unitsMatch?.[1]) continue

      const units = parseNum(unitsMatch[1])
      if (isNaN(units) || units <= 0) continue

      const nav           = navRe      ? (m => m ? parseNum(m[1]) : null)(block.match(navRe))      : null
      const investedValue = investedRe ? (m => m ? parseNum(m[1]) : null)(block.match(investedRe)) : null
      const isin          = isinRe     ? (block.match(isinRe)?.[1] ?? null)                        : null
      const folio         = folioRe    ? (block.match(folioRe)?.[1]?.trim() ?? '')                 : ''

      results.push({
        schemeName:   nameMatch[1].trim(),
        isin,
        folioNumber:  folio,
        units,
        purchaseNav:  investedValue && units ? investedValue / units : null,
        nav,
        investedValue,
        fundType:     null,
        purchaseDate: null,
        isSip:        false,
        sipAmount:    null,
      })
    }
  } catch {
    // Bad regex from AI — silently ignore
  }
  return results
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

  const pan           = extractPAN(text)
  const statementDate = extractStatementDate(text)
  const sipMap        = extractSIPDetails(text)
  const isinMap       = extractISINMap(text)

  let rawHoldings: Omit<ParsedMFHolding, 'schemeCode'>[] = []

  // 1. CAMS
  rawHoldings = parseCAMSSummary(text, sipMap, isinMap)

  // 2. MF Central
  if (!rawHoldings.length) rawHoldings = parseMFCentral(text, sipMap, isinMap)

  // 3. KFintech folio blocks
  if (!rawHoldings.length) rawHoldings = parseKFintechFolioBlocks(text, errors)

  // 4. AMC transaction statement
  if (!rawHoldings.length) rawHoldings = parseAMCTransactionStatement(text)

  // 5. Generic tabular (broker exports)
  if (!rawHoldings.length) rawHoldings = parseGenericTabular(text)

  // 6. AI format identification — last resort
  if (!rawHoldings.length) {
    const sample = text.slice(0, 1200)
    const hints  = await identifyFormatWithAI(sample)
    if (hints) rawHoldings = parseWithAIHints(text, hints)
  }

  // Resolve scheme codes (ISIN exact match → AMFI name fuzzy)
  const holdings = await Promise.all(
    rawHoldings.map(async h => ({
      ...h,
      schemeCode: await lookupSchemeCode(h.isin ?? null, h.schemeName),
    }))
  )

  return {
    holdings,
    pan,
    statementDate,
    errors,
    ...(holdings.length === 0 ? { _rawText: text.slice(0, 3000) } : {}),
  }
}
