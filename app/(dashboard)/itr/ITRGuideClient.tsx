'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, ChevronLeft, HelpCircle, Loader2, CheckCircle, ExternalLink, Sparkles, Rocket, Copy, Check } from 'lucide-react'
import { formatINR } from '@/lib/utils/format'
import { computeTax, type ITRInputs, type ITRResult } from '@/lib/analysis/itr'
import { clsx } from 'clsx'

interface PreFill {
  stcgEquity: number
  ltcgEquity: number
  cryptoGains: number
  section80C: number
  section80CCD1B: number
  section80D: number
  tdsDeducted: number
}

const STEPS = [
  { id: 1, label: 'About You',       short: 'Intro' },
  { id: 2, label: 'Income',          short: 'Income' },
  { id: 3, label: 'Capital Gains',   short: 'Gains' },
  { id: 4, label: 'Deductions',      short: 'Deduc.' },
  { id: 5, label: 'TDS Paid',        short: 'TDS' },
  { id: 6, label: 'Tax Summary',     short: 'Tax' },
  { id: 7, label: 'File Your ITR',   short: 'File' },
]

function AIExplain({ topic, context }: { topic: string; context?: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    if (text) { setOpen(!open); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch('/api/ai/itr-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setText(acc)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={load}
        className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        {open ? 'Hide' : 'What is this?'}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5 text-xs text-violet-800 leading-relaxed">
          {loading && !text
            ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Explaining…</span>
            : text}
        </div>
      )}
    </div>
  )
}

function NumberInput({
  label, value, onChange, hint, aiTopic, prefix = '₹', readOnly,
}: {
  label: string; value: number; onChange: (v: number) => void
  hint?: string; aiTopic?: string; prefix?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-sm text-zinc-400">{prefix}</span>
        <input
          type="number"
          min={0}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          readOnly={readOnly}
          className={clsx(
            'w-full pl-7 pr-4 py-2.5 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500',
            readOnly && 'bg-zinc-50 text-zinc-500 cursor-not-allowed'
          )}
        />
      </div>
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
      {aiTopic && <AIExplain topic={aiTopic} />}
    </div>
  )
}

export function ITRGuideClient({ preFill }: { preFill: PreFill }) {
  const [step, setStep] = useState(1)
  const [employmentType, setEmploymentType] = useState<'salaried' | 'business' | 'both'>('salaried')
  const [inputs, setInputs] = useState<ITRInputs>({
    grossSalary: 0,
    otherIncome: 0,
    stcgEquity: preFill.stcgEquity,
    ltcgEquity: preFill.ltcgEquity,
    cryptoGains: preFill.cryptoGains,
    debtGains: 0,
    section80C: preFill.section80C,
    section80CCD1B: preFill.section80CCD1B,
    section80D: preFill.section80D,
    hra: 0,
    otherDeductions: 0,
    tdsDeducted: preFill.tdsDeducted,
    advanceTax: 0,
  })
  const [result, setResult] = useState<ITRResult | null>(null)

  const set = useCallback((key: keyof ITRInputs, val: number) => {
    setInputs(prev => ({ ...prev, [key]: val }))
  }, [])

  function goNext() {
    if (step === 5) setResult(computeTax(inputs))
    if (step < STEPS.length) setStep(s => s + 1)
  }
  function goPrev() { if (step > 1) setStep(s => s - 1) }

  const fmt = (n: number) => formatINR(n)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">ITR Filing Guide</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Step-by-step guide to file your income tax return — plain English, no CA needed.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 flex-1 min-w-0">
            <button
              onClick={() => s.id < step && setStep(s.id)}
              className={clsx(
                'flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold shrink-0 transition-colors',
                s.id === step ? 'bg-emerald-600 text-white'
                  : s.id < step ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                  : 'bg-zinc-100 text-zinc-400'
              )}
            >
              {s.id < step ? <CheckCircle className="h-4 w-4" /> : s.id}
            </button>
            <span className={clsx('text-xs truncate hidden sm:block', s.id === step ? 'text-zinc-900 font-medium' : 'text-zinc-400')}>
              {s.short}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-zinc-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">

        {/* Step 1: Who are you */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 mb-1">Let's figure out which ITR form you need</h2>
              <p className="text-sm text-zinc-500">
                India has multiple ITR forms. Most salaried employees use ITR-1 or ITR-2 depending on whether they have capital gains.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'salaried', label: 'Salaried', desc: 'Salary from one employer + Form 16' },
                { value: 'business', label: 'Business / Freelance', desc: 'Income from business or profession' },
                { value: 'both', label: 'Both', desc: 'Salary + business income' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEmploymentType(opt.value as typeof employmentType)}
                  className={clsx(
                    'rounded-xl border-2 p-4 text-left transition-all',
                    employmentType === opt.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  <p className="text-sm font-semibold text-zinc-900">{opt.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">
                You'll likely file: {preFill.stcgEquity + preFill.ltcgEquity + preFill.cryptoGains > 0 ? 'ITR-2' : 'ITR-1'}
              </p>
              <p className="text-xs text-blue-600">
                {preFill.stcgEquity + preFill.ltcgEquity + preFill.cryptoGains > 0
                  ? 'You have capital gains from stocks/MFs/crypto — this requires ITR-2 (not ITR-1).'
                  : 'Simple salaried income with no capital gains = ITR-1. Easy to file!'}
              </p>
            </div>
            <AIExplain topic="difference between ITR-1 and ITR-2 for salaried employees" />
          </div>
        )}

        {/* Step 2: Income */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-900">Your income for FY 2025-26</h2>
            <p className="text-xs text-zinc-500">
              Find this on your Form 16 (Part B, Section 1). Your employer provides Form 16 by June 15.
            </p>
            <NumberInput
              label="Gross Salary (before any deductions)"
              value={inputs.grossSalary}
              onChange={(v) => set('grossSalary', v)}
              hint="Enter the figure from 'Gross Salary' in your Form 16 Part B"
              aiTopic="gross salary vs net salary and what to enter in ITR"
            />
            <NumberInput
              label="Other Income (interest, rental, etc.)"
              value={inputs.otherIncome}
              onChange={(v) => set('otherIncome', v)}
              hint="Bank interest (from Form 26AS), rental income, freelance income, etc."
              aiTopic="what counts as other income in ITR filing"
            />
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
              💡 <strong>Tip for new joiners:</strong> Your Form 16 is the most important document. Download it from your employer's HRMS portal or ask HR. It has all the numbers you need.
            </div>
          </div>
        )}

        {/* Step 3: Capital Gains */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Capital gains</h2>
              <p className="text-xs text-zinc-500">Pre-filled from your NidhiAI portfolio. Edit if needed.</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700 mb-4">
              ✓ Pre-filled from your portfolio. Verify against your broker's tax P&L statement.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="STCG — Equity (held < 1 year)"
                value={inputs.stcgEquity}
                onChange={(v) => set('stcgEquity', v)}
                hint="Taxed at flat 20%"
                aiTopic="short term capital gains on stocks and mutual funds"
              />
              <NumberInput
                label="LTCG — Equity (held > 1 year)"
                value={inputs.ltcgEquity}
                onChange={(v) => set('ltcgEquity', v)}
                hint="First ₹1.25L exempt; rest taxed at 12.5%"
                aiTopic="long term capital gains and the ₹1.25 lakh exemption"
              />
              <NumberInput
                label="Crypto Gains"
                value={inputs.cryptoGains}
                onChange={(v) => set('cryptoGains', v)}
                hint="All gains taxed at flat 30%, no exemptions"
                aiTopic="how crypto is taxed in India — Schedule VDA in ITR"
              />
              <NumberInput
                label="Debt MF / FD Interest Gains"
                value={inputs.debtGains}
                onChange={(v) => set('debtGains', v)}
                hint="Added to income, taxed at your slab rate"
                aiTopic="how debt mutual fund gains are taxed after 2023 rule change"
              />
            </div>
          </div>
        )}

        {/* Step 4: Deductions */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Deductions (old regime only)</h2>
              <p className="text-xs text-zinc-500">
                Pre-filled from your 80C optimizer. Only useful if choosing old regime — we'll compare both on the next step.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Section 80C"
                value={inputs.section80C}
                onChange={(v) => set('section80C', v)}
                hint="ELSS, PPF, NPS, LIC — max ₹1.5L"
                aiTopic="Section 80C deductions — what qualifies and the ₹1.5 lakh limit"
              />
              <NumberInput
                label="Section 80CCD(1B) — NPS"
                value={inputs.section80CCD1B}
                onChange={(v) => set('section80CCD1B', v)}
                hint="Additional NPS contribution — max ₹50K extra"
                aiTopic="80CCD(1B) — the extra ₹50,000 NPS deduction over 80C"
              />
              <NumberInput
                label="Section 80D — Health Insurance"
                value={inputs.section80D}
                onChange={(v) => set('section80D', v)}
                hint="Self ₹25K + senior citizen parents ₹50K"
                aiTopic="80D health insurance deduction — self and parents"
              />
              <NumberInput
                label="HRA Exemption"
                value={inputs.hra}
                onChange={(v) => set('hra', v)}
                hint="Only if you pay rent and your employer provides HRA"
                aiTopic="HRA exemption — how to calculate it and claim it in ITR"
              />
            </div>
          </div>
        )}

        {/* Step 5: TDS */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Tax already paid</h2>
              <p className="text-xs text-zinc-500">
                TDS deducted by your employer is shown in Form 16. Check Form 26AS on the Income Tax portal for full TDS credit.
              </p>
            </div>
            <NumberInput
              label="TDS Deducted by Employer"
              value={inputs.tdsDeducted}
              onChange={(v) => set('tdsDeducted', v)}
              hint="Found in Form 16 Part A or Form 26AS on incometax.gov.in"
              aiTopic="where to find TDS deducted and how it reduces your tax payable"
            />
            <NumberInput
              label="Advance Tax Paid"
              value={inputs.advanceTax}
              onChange={(v) => set('advanceTax', v)}
              hint="If you paid advance tax installments (usually ₹0 for salaried employees)"
              aiTopic="advance tax — who needs to pay it and when"
            />
            <AIExplain
              topic="Form 26AS and AIS — what they are and how to download them"
              context="first time ITR filer, salaried"
            />
          </div>
        )}

        {/* Step 6: Tax Summary */}
        {step === 6 && result && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Your tax computation</h2>
              <p className="text-xs text-zinc-500">FY 2025-26 (AY 2026-27) · Estimate only</p>
            </div>

            {/* Regime comparison */}
            <div className="grid grid-cols-2 gap-4">
              {[result.newRegime, result.oldRegime].map((r) => {
                const isRec = r.regime === result.recommended
                return (
                  <div
                    key={r.regime}
                    className={clsx(
                      'rounded-xl border-2 p-4',
                      isRec ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-zinc-900 capitalize">{r.regime} Regime</h3>
                      {isRec && (
                        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                          Recommended ✓
                        </span>
                      )}
                    </div>
                    <p className={clsx(
                      'text-2xl font-bold',
                      r.taxPayable < 0 ? 'text-emerald-600' : 'text-zinc-900'
                    )}>
                      {r.taxPayable < 0 ? `Refund: ${fmt(Math.abs(r.taxPayable))}` : fmt(r.taxPayable)}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Total tax: {fmt(r.totalTax)} · Eff. rate: {r.effectiveRate.toFixed(1)}%
                    </p>
                    <div className="mt-3 space-y-1 text-xs">
                      {r.breakdown.filter(b => b.amount > 0).map((b, i) => (
                        <div key={i} className="flex justify-between text-zinc-600">
                          <span>{b.label}</span>
                          <span className="font-medium">{fmt(b.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Saving callout */}
            {result.saving > 100 && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
                <strong>{result.recommended === 'new' ? 'New' : 'Old'} regime saves you {fmt(result.saving)}</strong>
                {result.recommended === 'new'
                  ? ' — The new regime is simpler and saves more for most salaried employees with standard deductions.'
                  : ' — The old regime saves more because your deductions (80C/HRA/NPS) are high enough to offset the higher rates.'}
              </div>
            )}

            <AIExplain
              topic="new regime vs old regime — which one to choose when filing ITR"
              context={`User saves ${fmt(result.saving)} by choosing ${result.recommended} regime. Their 80C is ${fmt(inputs.section80C)}`}
            />
          </div>
        )}

        {/* Step 7: File */}
        {step === 7 && result && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">You're ready to file!</h2>
              <p className="text-sm text-zinc-500">
                File {result.itrForm} on the Income Tax e-filing portal. Here's exactly what to do:
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  step: 1,
                  title: 'Log in to the Income Tax Portal',
                  body: 'Go to incometax.gov.in → Login with your PAN number. First time? Register using your PAN, name, and date of birth.',
                },
                {
                  step: 2,
                  title: `File > Income Tax Returns > ${result.itrForm}`,
                  body: `Select AY 2026-27 (for FY 2025-26 income). Choose "${result.itrForm}" — ${result.itrForm === 'ITR-1' ? 'for salaried income only' : 'you have capital gains so ITR-2 is required'}.`,
                },
                {
                  step: 3,
                  title: 'Import pre-filled data',
                  body: 'The portal auto-imports data from your employer. Click "Import Pre-filled data" — it pulls from Form 16, 26AS, and AIS automatically.',
                },
                {
                  step: 4,
                  title: `Select ${result.recommended === 'new' ? 'New' : 'Old'} Tax Regime`,
                  body: `Choose the ${result.recommended} regime — it saves you ${fmt(result.saving)}. Look for "Tax Regime" in the Personal Information section.`,
                },
                {
                  step: 5,
                  title: 'Verify salary and deductions',
                  body: `Your gross salary should show ~${fmt(inputs.grossSalary)}. Check 80C deductions show ${fmt(inputs.section80C)}.`,
                },
                {
                  step: 6,
                  title: 'Add capital gains (Schedule CG)',
                  body: inputs.stcgEquity + inputs.ltcgEquity + inputs.cryptoGains > 0
                    ? `Add STCG: ${fmt(inputs.stcgEquity)}, LTCG: ${fmt(inputs.ltcgEquity)}, Crypto (Schedule VDA): ${fmt(inputs.cryptoGains)}.`
                    : 'No capital gains to declare — skip this section.',
                },
                {
                  step: 7,
                  title: 'Submit and e-verify',
                  body: 'Submit your return. Then e-verify using Aadhaar OTP (instant, recommended) or net banking. You must verify within 30 days.',
                },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{s.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="https://www.incometax.gov.in/iec/foportal"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors w-fit"
            >
              <ExternalLink className="h-4 w-4" />
              Open Income Tax Portal
            </a>

            {/* Summary card */}
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-900">Your ITR Summary</p>
                <span className="text-xs text-zinc-400">AY 2026-27 · {result.itrForm} · {result.recommended} regime</span>
              </div>

              {/* Portal field mappings */}
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                  Where to enter each value on incometax.gov.in
                </p>
                <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 overflow-hidden">
                  {[
                    {
                      label: 'Gross Salary',
                      value: fmt(inputs.grossSalary),
                      portal: 'Part B-TI → B1 (Salaries)',
                      show: inputs.grossSalary > 0,
                    },
                    {
                      label: 'Other Income',
                      value: fmt(inputs.otherIncome),
                      portal: 'Schedule OS → B (Other sources)',
                      show: inputs.otherIncome > 0,
                    },
                    {
                      label: 'STCG — Equity',
                      value: fmt(inputs.stcgEquity),
                      portal: 'Schedule CG → B3 (Sec 111A, 20%)',
                      show: inputs.stcgEquity > 0,
                    },
                    {
                      label: 'LTCG — Equity',
                      value: fmt(inputs.ltcgEquity),
                      portal: 'Schedule CG → B5 (Sec 112A, 12.5%)',
                      show: inputs.ltcgEquity > 0,
                    },
                    {
                      label: 'Crypto / VDA Gains',
                      value: fmt(inputs.cryptoGains),
                      portal: 'Schedule VDA → Total proceeds − cost',
                      show: inputs.cryptoGains > 0,
                    },
                    {
                      label: 'Debt MF / FD Gains',
                      value: fmt(inputs.debtGains),
                      portal: 'Schedule OS → A (Other income at slab)',
                      show: inputs.debtGains > 0,
                    },
                    {
                      label: 'Section 80C',
                      value: fmt(inputs.section80C),
                      portal: 'Part C → Deductions → 80C',
                      show: inputs.section80C > 0,
                    },
                    {
                      label: '80CCD(1B) — NPS',
                      value: fmt(inputs.section80CCD1B),
                      portal: 'Part C → Deductions → 80CCD(1B)',
                      show: inputs.section80CCD1B > 0,
                    },
                    {
                      label: 'Section 80D — Health',
                      value: fmt(inputs.section80D),
                      portal: 'Part C → Deductions → 80D',
                      show: inputs.section80D > 0,
                    },
                    {
                      label: 'HRA Exemption',
                      value: fmt(inputs.hra),
                      portal: 'Part B-TI → Exempt allowances (10(13A))',
                      show: inputs.hra > 0,
                    },
                    {
                      label: 'TDS Deducted',
                      value: fmt(inputs.tdsDeducted),
                      portal: 'Schedule TDS1 / TDS2 → auto-imports from 26AS',
                      show: inputs.tdsDeducted > 0,
                    },
                    {
                      label: 'Total Tax',
                      value: fmt(result[`${result.recommended}Regime`].totalTax),
                      portal: 'Part B-TTI → Tax payable on total income',
                      show: true,
                    },
                    {
                      label: result[`${result.recommended}Regime`].taxPayable < 0 ? 'Refund Due' : 'Tax Payable',
                      value: fmt(Math.abs(result[`${result.recommended}Regime`].taxPayable)),
                      portal: result[`${result.recommended}Regime`].taxPayable < 0
                        ? 'Part B-TTI → Refund — verify your bank account'
                        : 'Pay via Challan 280 before filing',
                      show: true,
                      highlight: true,
                      positive: result[`${result.recommended}Regime`].taxPayable < 0,
                    },
                  ].filter(r => r.show).map((row, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white text-xs">
                      <div className="flex-1 min-w-0">
                        <span className={clsx('font-medium', row.highlight && (row.positive ? 'text-emerald-700' : 'text-red-600'))}>
                          {row.label}
                        </span>
                        <p className="text-zinc-400 mt-0.5 truncate">{row.portal}</p>
                      </div>
                      <span className={clsx(
                        'font-semibold shrink-0',
                        row.highlight ? (row.positive ? 'text-emerald-600' : 'text-red-600') : 'text-zinc-900'
                      )}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coming soon: auto-filing */}
            <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50 p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Rocket className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-900">Coming soon: Auto-filing</p>
                  <p className="text-xs text-violet-600 mt-1 leading-relaxed">
                    In the next update, NidhiAI will fill your ITR automatically — it'll read your portfolio gains, deductions, and TDS, and pre-populate every field on the portal so you just review and submit. No manual data entry. No CA needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t border-zinc-100">
          <button
            onClick={goPrev}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length && (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {step === 5 ? 'Calculate Tax' : 'Continue'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
