'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, PenLine } from 'lucide-react'
import Link from 'next/link'
import { formatINR, formatUnits } from '@/lib/utils/format'
import type { ParsedMFHolding } from '@/lib/parsers/cas'

type ParseResult = {
  holdings: ParsedMFHolding[]
  pan: string | null
  statementDate: string | null
  errors: string[]
}

type SaveState = 'idle' | 'saving' | 'done' | 'error'

export function CASImporter() {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [manualCodes, setManualCodes] = useState<Record<number, string>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleUpload() {
    if (!file) return
    setParsing(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/import/cas', { method: 'POST', body: formData })
    const data: ParseResult = await res.json()

    setResult(data)
    setManualCodes({})
    // Pre-select all holdings (including those without scheme code — user can fill it in)
    setSelected(new Set(data.holdings.map((_, i) => i)))
    setParsing(false)
  }

  async function handleSave() {
    if (!result) return
    setSaveState('saving')
    setSaveError('')

    const toSave = result.holdings
      .map((h, i) => ({ h, i, code: h.schemeCode ?? (manualCodes[i] ? parseInt(manualCodes[i], 10) : null) }))
      .filter(({ i, code }) => selected.has(i) && code !== null && !isNaN(code as number))

    try {
      const res = await fetch('/api/portfolio/mutual-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: toSave.map(({ h, code }) => ({
          scheme_code: code!,
          scheme_name: h.schemeName,
          folio_number: h.folioNumber || null,
          units: h.units,
          purchase_nav: h.purchaseNav ?? h.nav,
          purchase_date: h.purchaseDate || null,
          fund_type: h.fundType || null,
          is_sip: h.isSip,
          sip_amount: h.sipAmount,
        })) }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Save failed')
      }

      setSaveState('done')
      setTimeout(() => router.push('/holdings/mutual-funds'), 1500)
    } catch (e) {
      setSaveState('error')
      setSaveError(String(e))
    }
  }

  function toggleAll(checked: boolean) {
    if (!result) return
    setSelected(checked ? new Set(result.holdings.map((_, i) => i)) : new Set())
  }

  return (
    <div className="space-y-6">
      {/* Upload card */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Step 1 — Upload CAS PDF</h2>

        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
        >
          <Upload className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
          {file ? (
            <div>
              <p className="text-sm font-medium text-zinc-900">{file.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-zinc-700">Click to select your CAS PDF</p>
              <p className="text-xs text-zinc-500 mt-1">CAMS or KFintech · Max 10 MB</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { setFile(f); setResult(null) }
            }}
          />
        </div>

        <div className="mt-4 space-y-2 text-xs text-zinc-500">
          <p>How to get your CAS PDF:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-medium">CAMS:</span> camsonline.com → Investor Services → Statement → Detailed</li>
            <li><span className="font-medium">KFintech:</span> kfintech.com → MF Investors → Statement of Account</li>
          </ul>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || parsing}
          className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {parsing ? 'Parsing…' : 'Parse PDF'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Step 2 — Review &amp; Import
            </h2>
            <div className="text-xs text-zinc-500">
              {result.pan && <span className="mr-3">PAN: <span className="font-medium text-zinc-700">{result.pan}</span></span>}
              {result.statementDate && <span>Date: <span className="font-medium text-zinc-700">{result.statementDate}</span></span>}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-medium mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> {result.errors.length} block(s) could not be parsed
              </div>
              <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
                {result.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {result.holdings.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Could not parse this statement format</p>
                <p className="text-xs text-amber-700 mt-1">
                  This PDF format isn't supported yet. You can add your mutual funds manually instead.
                </p>
              </div>
              <Link
                href="/holdings/mutual-funds"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
              >
                <PenLine className="h-4 w-4" /> Add funds manually
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100">
                      <th className="pr-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.size > 0 && selected.size === result.holdings.filter((h) => h.schemeCode !== null).length}
                          onChange={(e) => toggleAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-2 py-2 font-medium">Fund</th>
                      <th className="px-2 py-2 font-medium">Folio</th>
                      <th className="px-2 py-2 font-medium text-right">Units</th>
                      <th className="px-2 py-2 font-medium text-right">Avg NAV</th>
                      <th className="px-2 py-2 font-medium text-right">Value</th>
                      <th className="px-2 py-2 font-medium text-center">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {result.holdings.map((h, i) => {
                      const isSelected = selected.has(i)
                      return (
                        <tr key={i} className="hover:bg-zinc-50">
                          <td className="pr-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selected)
                                if (e.target.checked) next.add(i)
                                else next.delete(i)
                                setSelected(next)
                              }}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="font-medium text-zinc-900 max-w-[280px] truncate" title={h.schemeName}>
                              {h.schemeName}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-zinc-500 text-xs">{h.folioNumber}</td>
                          <td className="px-2 py-2.5 text-right text-zinc-700">{formatUnits(h.units)}</td>
                          <td className="px-2 py-2.5 text-right text-zinc-500">
                            {h.purchaseNav ? formatINR(h.purchaseNav) : '—'}
                          </td>
                          <td className="px-2 py-2.5 text-right font-medium text-zinc-900">
                            {h.investedValue ? formatINR(h.investedValue) : '—'}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            {h.schemeCode ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle className="h-3 w-3" /> {h.schemeCode}
                              </span>
                            ) : (
                              <input
                                type="number"
                                placeholder="Enter code"
                                value={manualCodes[i] ?? ''}
                                onChange={(e) => setManualCodes(prev => ({ ...prev, [i]: e.target.value }))}
                                className="w-24 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-zinc-800 focus:border-emerald-500 focus:outline-none"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <p className="text-xs text-zinc-500">
                  {selected.size} of {result.holdings.length} funds selected
                  {result.holdings.some((h) => h.schemeCode === null) && (
                    <span className="text-amber-600 ml-2">
                      · {result.holdings.filter((h) => h.schemeCode === null).length} code(s) not found — enter manually
                    </span>
                  )}
                </p>

                {saveState === 'done' ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <CheckCircle className="h-4 w-4" /> Saved! Redirecting…
                  </span>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={selected.size === 0 || saveState === 'saving'}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {saveState === 'saving' ? 'Saving…' : `Import ${selected.size} fund${selected.size !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {saveState === 'error' && (
                <p className="text-xs text-red-600">{saveError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* How it works */}
      {!result && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-400" /> How it works
          </h2>
          <ol className="space-y-2 text-sm text-zinc-600 list-decimal list-inside">
            <li>Upload your CAS PDF (password-protected PDFs are not yet supported)</li>
            <li>We extract all mutual fund folios, units, and NAV from the statement</li>
            <li>Scheme codes are looked up automatically from AMFI</li>
            <li>Review the results, deselect any you don't want, then click Import</li>
          </ol>
        </div>
      )}
    </div>
  )
}
