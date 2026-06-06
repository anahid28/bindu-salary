'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, Check, RefreshCw, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

// ── Column normaliser ────────────────────────────────────────────────────────
const FIELD_MAP: Record<string, string> = {
  // employee_id
  employeeid: 'employee_id', empid: 'employee_id', id: 'employee_id',
  empno: 'employee_id', employeeno: 'employee_id', 'emp#': 'employee_id',
  // name
  name: 'name', fullname: 'name', employeename: 'name', empname: 'name',
  // designation
  designation: 'designation', position: 'designation', role: 'designation',
  title: 'designation', jobtitle: 'designation',
  // branch
  branch: 'branch', branchname: 'branch', office: 'branch', location: 'branch',
  // basic_salary
  basicsalary: 'basic_salary', basic: 'basic_salary', salary: 'basic_salary',
  grosssalary: 'basic_salary', monthlysalary: 'basic_salary',
  // yearly_leave_allowance
  yearlyleave: 'yearly_leave_allowance', annualleave: 'yearly_leave_allowance',
  leavedays: 'yearly_leave_allowance', leave: 'yearly_leave_allowance',
  leaveallowance: 'yearly_leave_allowance',
  // conveyance
  conveyance: 'conveyance', transport: 'conveyance', allowance: 'conveyance',
  travelallowance: 'conveyance',
}

function normalise(header: string) {
  return header.toLowerCase().replace(/[\s_\-().]+/g, '')
}

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const key = FIELD_MAP[normalise(h)]
    if (key && !(key in map)) map[key] = i
  })
  return map
}

// ── Types ────────────────────────────────────────────────────────────────────
type ParsedRow = {
  employee_id: string
  name: string
  designation: string
  branch: string         // raw name from sheet
  basic_salary: number
  yearly_leave_allowance: number
  conveyance: number
  _status: 'new' | 'update' | 'error'
  _errors: string[]
}

type ImportResult = { added: number; updated: number; failed: number }

// ── Template download ────────────────────────────────────────────────────────
async function downloadTemplate() {
  const { utils, writeFile } = await import('xlsx')
  const ws = utils.aoa_to_sheet([
    ['Employee ID', 'Name', 'Designation', 'Branch', 'Basic Salary', 'Yearly Leave', 'Conveyance'],
    ['001', 'John Doe', 'Sales Executive', 'Head Office', 15000, 12, 1500],
  ])
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Employees')
  writeFile(wb, 'employee-import-template.xlsx')
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

export function ImportModal({ open, onOpenChange, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [missingCols, setMissingCols] = useState<string[]>([])

  function reset() {
    setStep('upload')
    setRows([])
    setResult(null)
    setMissingCols([])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function parseFile(file: File) {
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: string[][] = utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (raw.length < 2) { toast.error('Sheet is empty'); return }

    const headers = (raw[0] as string[]).map(String)
    const colMap = mapHeaders(headers)

    const required = ['employee_id', 'name', 'designation', 'branch', 'basic_salary']
    const missing = required.filter(f => !(f in colMap))
    if (missing.length) {
      setMissingCols(missing)
      setStep('preview')
      setRows([])
      return
    }

    // Fetch existing employee_ids for new/update detection
    const { data: existing } = await supabase.from('employees').select('employee_id')
    const existingIds = new Set((existing ?? []).map(e => e.employee_id))

    const parsed: ParsedRow[] = []
    for (let i = 1; i < raw.length; i++) {
      const r = raw[i] as string[]
      if (r.every(c => String(c).trim() === '')) continue  // skip empty rows

      const emp_id   = String(r[colMap.employee_id] ?? '').trim()
      const name     = String(r[colMap.name] ?? '').trim()
      const desig    = String(r[colMap.designation] ?? '').trim()
      const branch   = String(r[colMap.branch] ?? '').trim()
      const salary   = parseFloat(String(r[colMap.basic_salary] ?? '0').replace(/[^\d.]/g, '')) || 0
      const leave    = 'yearly_leave_allowance' in colMap
        ? parseInt(String(r[colMap.yearly_leave_allowance] ?? '12')) || 12
        : 12
      const conv     = 'conveyance' in colMap
        ? parseFloat(String(r[colMap.conveyance] ?? '1500').replace(/[^\d.]/g, '')) || 1500
        : 1500

      const errors: string[] = []
      if (!emp_id)  errors.push('Missing Employee ID')
      if (!name)    errors.push('Missing Name')
      if (!desig)   errors.push('Missing Designation')
      if (!branch)  errors.push('Missing Branch')
      if (salary <= 0) errors.push('Invalid Salary')

      parsed.push({
        employee_id: emp_id,
        name,
        designation: desig,
        branch,
        basic_salary: salary,
        yearly_leave_allowance: leave,
        conveyance: conv,
        _status: errors.length ? 'error' : existingIds.has(emp_id) ? 'update' : 'new',
        _errors: errors,
      })
    }

    setRows(parsed)
    setMissingCols([])
    setStep('preview')
  }

  async function runImport() {
    const valid = rows.filter(r => r._status !== 'error')
    if (!valid.length) { toast.error('No valid rows to import'); return }
    setImporting(true)

    // 1. Build branch name → id map (create missing ones)
    const { data: existing } = await supabase.from('branches').select('id, name')
    const branchMap = new Map<string, string>((existing ?? []).map(b => [b.name.toLowerCase(), b.id]))

    const uniqueBranches = [...new Set(valid.map(r => r.branch))]
    for (const bname of uniqueBranches) {
      if (!branchMap.has(bname.toLowerCase())) {
        const { data } = await supabase.from('branches').insert({ name: bname }).select('id').single()
        if (data) branchMap.set(bname.toLowerCase(), data.id)
      }
    }

    // 2. Upsert employees
    let added = 0, updated = 0, failed = 0
    const upsertRows = valid.map(r => ({
      employee_id: r.employee_id,
      name: r.name,
      designation: r.designation,
      branch_id: branchMap.get(r.branch.toLowerCase()),
      basic_salary: r.basic_salary,
      yearly_leave_allowance: r.yearly_leave_allowance,
      conveyance: r.conveyance,
      active: true,
    })).filter(r => r.branch_id)  // skip any branch that failed to create

    const { error } = await supabase
      .from('employees')
      .upsert(upsertRows, { onConflict: 'employee_id' })

    if (error) {
      toast.error(error.message)
      failed = upsertRows.length
    } else {
      added   = rows.filter(r => r._status === 'new').length
      updated = rows.filter(r => r._status === 'update').length
      failed  = rows.filter(r => r._status === 'error').length
    }

    setResult({ added, updated, failed })
    setStep('done')
    setImporting(false)
    if (!error) onDone()
  }

  const newCount    = rows.filter(r => r._status === 'new').length
  const updateCount = rows.filter(r => r._status === 'update').length
  const errorCount  = rows.filter(r => r._status === 'error').length

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Employees from Excel / CSV</DialogTitle>
        </DialogHeader>

        {/* ── Step: Upload ── */}
        {step === 'upload' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f) }}
            >
              <FileSpreadsheet size={36} className="text-gray-300" />
              <p className="text-gray-600 font-medium">Drop your Excel or CSV file here</p>
              <p className="text-xs text-gray-400">Supported: .xlsx · .xls · .csv</p>
              <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                <Upload size={14} /> Browse file
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Not sure about the format?</p>
              <Button variant="ghost" size="sm" className="gap-2 text-blue-600" onClick={downloadTemplate}>
                <Download size={14} /> Download Template
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 w-full">
              <p className="font-medium text-gray-700 mb-1">Required columns (any order, flexible names):</p>
              <p>Employee ID · Name · Designation · Branch · Basic Salary</p>
              <p className="mt-1">Optional: Yearly Leave (default 12) · Conveyance (default ৳1500)</p>
            </div>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === 'preview' && (
          <>
            {missingCols.length > 0 ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <AlertCircle size={36} className="text-red-400" />
                <p className="font-semibold text-gray-800">Missing required columns</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {missingCols.map(c => <Badge key={c} variant="destructive">{c.replace(/_/g, ' ')}</Badge>)}
                </div>
                <p className="text-sm text-gray-500">Please fix your file and re-upload.</p>
                <Button variant="outline" onClick={reset}>Try again</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{rows.length} rows detected</span>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{newCount} new</Badge>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{updateCount} update</Badge>
                  {errorCount > 0 && <Badge variant="destructive">{errorCount} errors</Badge>}
                  <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-xs" onClick={reset}>
                    <Upload size={12} /> Change file
                  </Button>
                </div>

                <div className="overflow-auto flex-1 -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 text-xs">Status</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 text-xs">ID</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 text-xs">Name</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 text-xs">Designation</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 text-xs">Branch</th>
                        <th className="text-right py-2 pr-3 font-medium text-gray-500 text-xs">Basic</th>
                        <th className="text-right py-2 font-medium text-gray-500 text-xs">Leave/Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={`border-b border-gray-50 ${r._status === 'error' ? 'bg-red-50/50' : ''}`}>
                          <td className="py-2 pr-3">
                            {r._status === 'new'    && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs font-normal">New</Badge>}
                            {r._status === 'update' && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs font-normal">Update</Badge>}
                            {r._status === 'error'  && (
                              <span className="text-xs text-red-600" title={r._errors.join(', ')}>
                                ⚠ {r._errors[0]}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs text-gray-500">{r.employee_id || '—'}</td>
                          <td className="py-2 pr-3 font-medium text-gray-800">{r.name || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600 text-xs">{r.designation}</td>
                          <td className="py-2 pr-3 text-gray-600 text-xs">{r.branch}</td>
                          <td className="py-2 pr-3 text-right text-gray-700">৳{r.basic_salary.toLocaleString('en-BD')}</td>
                          <td className="py-2 text-right text-xs text-gray-500">{r.yearly_leave_allowance}d / ৳{r.conveyance.toLocaleString('en-BD')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
                  <Button variant="outline" onClick={reset}>Cancel</Button>
                  <Button
                    onClick={runImport}
                    disabled={importing || (newCount + updateCount) === 0}
                    className="gap-2"
                  >
                    {importing ? <><RefreshCw size={14} className="animate-spin" /> Importing…</> : <>
                      <Check size={14} /> Import {newCount + updateCount} employees
                    </>}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-5 py-10">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={26} className="text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-800">Import complete</p>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{result.added}</p>
                <p className="text-sm text-gray-500">Added</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-sm text-gray-500">Updated</p>
              </div>
              {result.failed > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{result.failed}</p>
                  <p className="text-sm text-gray-500">Skipped</p>
                </div>
              )}
            </div>
            <Button onClick={() => { onOpenChange(false); reset() }}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
