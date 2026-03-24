import { CASImporter } from './CASImporter'

export default function ImportPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Import Holdings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Upload your CAMS or KFintech Consolidated Account Statement (CAS) PDF to auto-import all mutual fund holdings.
        </p>
      </div>
      <CASImporter />
    </div>
  )
}
