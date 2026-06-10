'use client'

import { useEffect, useState, useRef, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch, SalaryRecord } from '@/types'
import { MONTHS } from '@/types'
import { calcSalary, formatTaka } from '@/lib/calculations'
import { downloadTemplate, parseSalarySheet } from '@/lib/excel'
import { downloadCSV } from '@/lib/csv'
import { toast } from 'sonner'
import { Save, ChevronRight, Download, Upload, Users, CheckCircle2, Clock, CalendarDays, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchFilter, type SortOption } from '@/components/shared/SearchFilter'

const ATTENDANCE_BONUS_AMOUNT = 700

type Row = {
  employee: Employee
  record: Partial<SalaryRecord>
  dirty: boolean
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name A–Z', value: 'name_asc' },
  { label: 'Name Z–A', value: 'name_desc' },
  { label: 'Net Payable ↑', value: 'net_asc' },
  { label: 'Net Payable ↓', value: 'net_desc' },
  { label: 'Branch', value: 'branch' },
]

function SalaryContent() {
  const params = useSearchParams()
  const router = useRouter()
  const now = new Date()
  const currentYear = now.getFullYear()
  const [month, setMonth] = useState(+(params.get('month') ?? now.getMonth() + 1))
  const [year, setYear] = useState(+(params.get('year') ?? currentYear))
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [filterBranch, setFilterBranch] = useState('all')
  const [branches, setBranches] = useState<Branch[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [yearlyLeaveMap, setYearlyLeaveMap] = useState<Map<string, number>>(new Map())
  const [pageLoading, setPageLoading] = useState(true)
  const [uploadLog, setUploadLog] = useState<{ file_name: string; records_imported: number; uploaded_at: string } | null>(null)
  const [search, setSearch] = useState('')
  const [sortValue, setSortValue] = useState('name_asc')
  const [confirmClearMonth, setConfirmClearMonth] = useState(false)
  const [confirmDeleteRecId, setConfirmDeleteRecId] = useState<string | null>(null)

  async function load() {
    setPageLoading(true)
    const [{ data: emps }, { data: recs }, { data: brs }, { data: yearRecs }, { data: logData }] = await Promise.all([
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true).order('name'),
      supabase.from('salary_records').select('*').eq('month', month).eq('year', year),
      supabase.from('branches').select('*').order('name'),
      supabase.from('salary_records').select('employee_id, leave_adjustment').eq('year', year),
      supabase.from('salary_upload_log').select('file_name, records_imported, uploaded_at').eq('month', month).eq('year', year).maybeSingle(),
    ])

    const leaveMap = new Map<string, number>()
    for (const r of (yearRecs ?? [])) {
      leaveMap.set(r.employee_id, (leaveMap.get(r.employee_id) ?? 0) + (r.leave_adjustment ?? 0))
    }
    setYearlyLeaveMap(leaveMap)

    const recMap = new Map((recs ?? []).map(r => [r.employee_id, r]))
    setRows((emps ?? []).map(emp => ({
      employee: emp as Employee,
      record: recMap.get(emp.id) ?? {
        employee_id: emp.id, month, year,
        advance_deducted: 0, leave_days_taken: 0, leave_adjustment: 0,
        late_days: 0, ot_days: 0, attendance_bonus: 0,
        conveyance: (emp as Employee).conveyance,
        notes: '',
      },
      dirty: false,
    })))
    setBranches(brs ?? [])
    setUploadLog(logData as { file_name: string; records_imported: number; uploaded_at: string } | null)
    setPageLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  function update(empId: string, field: keyof SalaryRecord, value: number | string) {
    setRows(prev => prev.map(r =>
      r.employee.id === empId ? { ...r, record: { ...r.record, [field]: value }, dirty: true } : r
    ))
  }

  async function saveAll() {
    const dirty = rows.filter(r => r.dirty)
    if (!dirty.length) { toast.info('Nothing to save'); return }
    setSaving(true)
    const upserts = dirty.map(r => ({
      employee_id: r.record.employee_id,
      month: r.record.month,
      year: r.record.year,
      advance_deducted: r.record.advance_deducted ?? 0,
      leave_days_taken: r.record.leave_days_taken ?? 0,
      leave_adjustment: r.record.leave_adjustment ?? 0,
      late_days: r.record.late_days ?? 0,
      ot_days: r.record.ot_days ?? 0,
      attendance_bonus: r.record.attendance_bonus ?? 0,
      conveyance: r.record.conveyance ?? r.employee.conveyance,
      notes: r.record.notes ?? '',
    }))
    const { error } = await supabase.from('salary_records').upsert(upserts, { onConflict: 'employee_id,month,year' })
    if (error) toast.error(error.message)
    else {
      toast.success(`Saved ${dirty.length} records`)
      setRows(prev => prev.map(r => ({ ...r, dirty: false })))
    }
    setSaving(false)
  }

  async function deleteRecord(row: Row) {
    if (row.record.id) {
      const { error } = await supabase.from('salary_records').delete().eq('id', row.record.id)
      if (error) { toast.error(error.message); return }
    }
    setRows(prev => prev.map(r =>
      r.employee.id === row.employee.id
        ? { ...r, record: { employee_id: r.employee.id, month, year, advance_deducted: 0, leave_days_taken: 0, leave_adjustment: 0, late_days: 0, ot_days: 0, attendance_bonus: 0, conveyance: r.employee.conveyance, notes: '' }, dirty: false }
        : r
    ))
    setConfirmDeleteRecId(null)
    toast.success(`${row.employee.name}'s ${MONTHS[month - 1]} data cleared`)
  }

  async function clearMonth() {
    const empIds = rows.map(r => r.employee.id)
    const { error } = await supabase.from('salary_records').delete().eq('month', month).eq('year', year).in('employee_id', empIds)
    if (error) { toast.error(error.message); return }
    await supabase.from('salary_upload_log').delete().eq('month', month).eq('year', year)
    setConfirmClearMonth(false)
    toast.success(`All ${MONTHS[month - 1]} ${year} salary data cleared`)
    load()
  }

  const dirtyCount = rows.filter(r => r.dirty).length

  const displayed = useMemo(() => {
    let list = filterBranch === 'all' ? [...rows] : rows.filter(r => r.employee.branch_id === filterBranch)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.employee.name.toLowerCase().includes(q) || r.employee.employee_id.toLowerCase().includes(q))
    }
    switch (sortValue) {
      case 'name_asc': list.sort((a, b) => a.employee.name.localeCompare(b.employee.name)); break
      case 'name_desc': list.sort((a, b) => b.employee.name.localeCompare(a.employee.name)); break
      case 'net_asc': list.sort((a, b) => {
        const ca = calcSalary(a.employee, { ...a.record, leave_days_taken: a.record.leave_days_taken ?? 0, leave_adjustment: a.record.leave_adjustment ?? 0, conveyance: a.record.conveyance ?? a.employee.conveyance } as SalaryRecord)
        const cb = calcSalary(b.employee, { ...b.record, leave_days_taken: b.record.leave_days_taken ?? 0, leave_adjustment: b.record.leave_adjustment ?? 0, conveyance: b.record.conveyance ?? b.employee.conveyance } as SalaryRecord)
        return ca.net_payable - cb.net_payable
      }); break
      case 'net_desc': list.sort((a, b) => {
        const ca = calcSalary(a.employee, { ...a.record, leave_days_taken: a.record.leave_days_taken ?? 0, leave_adjustment: a.record.leave_adjustment ?? 0, conveyance: a.record.conveyance ?? a.employee.conveyance } as SalaryRecord)
        const cb = calcSalary(b.employee, { ...b.record, leave_days_taken: b.record.leave_days_taken ?? 0, leave_adjustment: b.record.leave_adjustment ?? 0, conveyance: b.record.conveyance ?? b.employee.conveyance } as SalaryRecord)
        return cb.net_payable - ca.net_payable
      }); break
      case 'branch': list.sort((a, b) => ((a.employee.branch as any)?.name ?? '').localeCompare((b.employee.branch as any)?.name ?? '')); break
    }
    return list
  }, [rows, filterBranch, search, sortValue])

  const totals = useMemo(() => {
    let advance = 0, leave = 0, late = 0, ot = 0, bonus = 0, conveyance = 0, net = 0
    displayed.forEach(row => {
      const rec = row.record as SalaryRecord
      const calc = calcSalary(row.employee, { ...rec, leave_days_taken: rec.leave_days_taken ?? 0, leave_adjustment: rec.leave_adjustment ?? 0, conveyance: rec.conveyance ?? row.employee.conveyance } as SalaryRecord)
      advance += calc.advance_deducted
      leave += calc.leave_deduction
      late += calc.late_deduction
      ot += calc.ot_addition
      bonus += calc.attendance_bonus
      conveyance += calc.conveyance
      net += calc.net_payable
    })
    return { advance, leave, late, ot, bonus, conveyance, net, count: displayed.length }
  }, [displayed])

  const allChecked = displayed.length > 0 && displayed.every(r => (r.record.attendance_bonus ?? 0) === ATTENDANCE_BONUS_AMOUNT)
  const someChecked = displayed.some(r => (r.record.attendance_bonus ?? 0) === ATTENDANCE_BONUS_AMOUNT)

  function toggleAllBonus(checked: boolean) {
    const value = checked ? ATTENDANCE_BONUS_AMOUNT : 0
    setRows(prev => prev.map(r =>
      filterBranch === 'all' || r.employee.branch_id === filterBranch
        ? { ...r, record: { ...r.record, attendance_bonus: value }, dirty: true }
        : r
    ))
  }

  function handleDownloadTemplate() {
    const emps = rows.map(r => r.employee)
    const recs = rows.map(r => r.record as SalaryRecord)
    downloadTemplate(emps, month, year, recs)
    toast.success('Template downloaded — fill in the data and upload it back')
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { rows: sheetRows, errors } = await parseSalarySheet(file)
    if (errors.length > 0) errors.forEach(err => toast.error(err))
    if (sheetRows.length === 0) {
      toast.error('No data found in the uploaded file')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const sheetByIdMap = new Map<string, typeof sheetRows[0]>()
    const sheetByNameMap = new Map<string, typeof sheetRows[0]>()
    for (const sr of sheetRows) {
      if (sr.employee_id) sheetByIdMap.set(sr.employee_id, sr)
      if (sr.name) sheetByNameMap.set(sr.name.toLowerCase(), sr)
    }
    let matched = 0, unmatched = 0
    setRows(prev => prev.map(row => {
      const emp = row.employee
      const sheetRow = sheetByIdMap.get(emp.employee_id) ?? sheetByNameMap.get(emp.name.toLowerCase())
      if (!sheetRow) { unmatched++; return row }
      matched++
      return { ...row, record: { ...row.record, advance_deducted: sheetRow.advance_deducted, leave_days_taken: sheetRow.leave_days_taken, leave_adjustment: sheetRow.leave_adjustment, late_days: sheetRow.late_days, ot_days: sheetRow.ot_days, conveyance: sheetRow.conveyance || emp.conveyance, attendance_bonus: sheetRow.attendance_bonus, notes: sheetRow.notes || row.record.notes || '' }, dirty: true }
    }))
    toast.success(`Imported ${matched} employee records`)
    if (unmatched > 0) toast.warning(`${unmatched} employees not matched`)
    await supabase.from('salary_upload_log').upsert({ month, year, file_name: file.name, records_imported: matched, records_updated: matched, source: 'excel' }, { onConflict: 'month,year' })
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function exportCSV() {
    const headers = ['Employee', 'Branch', 'Basic', 'Advance', 'Leave Deduction', 'Late Deduction', 'OT Addition', 'Att. Bonus', 'Conveyance', 'Net Payable']
    const csvRows = displayed.map(row => {
      const rec = row.record as SalaryRecord
      const calc = calcSalary(row.employee, { ...rec, leave_days_taken: rec.leave_days_taken ?? 0, leave_adjustment: rec.leave_adjustment ?? 0, conveyance: rec.conveyance ?? row.employee.conveyance } as SalaryRecord)
      return [row.employee.name, (row.employee.branch as any)?.name ?? '', calc.basic_salary, calc.advance_deducted, Math.round(calc.leave_deduction), Math.round(calc.late_deduction), Math.round(calc.ot_addition), calc.attendance_bonus, calc.conveyance, calc.net_payable]
    })
    downloadCSV(headers, csvRows, `Salary_${MONTHS[month - 1]}_${year}`)
    toast.success(`Exported ${displayed.length} salary records`)
  }

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-4 sm:mb-6">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Salary Processing</h1>
            <p className="text-gray-500 text-sm mt-0.5">Input monthly data for each employee</p>
          </div>
          {/* Period selectors always visible */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(month)} onValueChange={v => setMonth(+(v ?? month))}>
              <SelectTrigger className="w-36 bg-white border-gray-300 text-gray-900"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(+(v ?? year))}>
              <SelectTrigger className="w-24 bg-white border-gray-300 text-gray-900"><SelectValue /></SelectTrigger>
              <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* File actions */}
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs bg-white border-gray-300 text-gray-900 hover:bg-gray-50">
            <Download size={14} />Template
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs bg-white border-gray-300 text-gray-900 hover:bg-gray-50">
            <Upload size={14} />{uploading ? 'Importing…' : 'Upload'}
          </Button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Primary actions */}
          <Button onClick={saveAll} disabled={saving || dirtyCount === 0} size="sm" className="gap-2 relative text-gray-900">
            <Save size={14} />{saving ? 'Saving…' : 'Save All'}
            {dirtyCount > 0 && !saving && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {dirtyCount > 99 ? '99+' : dirtyCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/slips?month=${month}&year=${year}`)} className="gap-1.5 bg-white border-gray-300 text-gray-900 hover:bg-gray-50">
            View Slips <ChevronRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/feed?year=${year}`)} className="gap-1.5 text-xs text-gray-600 hover:text-gray-900">
            <CalendarDays size={14} />Feed
          </Button>

          <div className="ml-auto">
            {confirmClearMonth ? (
              <div className="flex items-center gap-1.5 border border-red-200 bg-red-50 rounded-lg px-2 py-1">
                <span className="text-xs text-red-700 font-medium whitespace-nowrap">Clear all {MONTHS[month - 1]}?</span>
                <button onClick={clearMonth} className="px-2 py-0.5 rounded text-xs bg-red-600 text-white hover:bg-red-700">Yes</button>
                <button onClick={() => setConfirmClearMonth(false)} className="px-2 py-0.5 rounded text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClearMonth(true)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title={`Clear all ${MONTHS[month - 1]} ${year} salary data`}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Status banners ─────────────────────────────────────────────── */}
      {uploadLog && (
        <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm">
          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-emerald-800 font-medium">{uploadLog.records_imported} records imported</span>
            <span className="text-emerald-600 ml-2 hidden sm:inline">from {uploadLog.file_name || 'Excel upload'}</span>
          </div>
          <span className="text-xs text-emerald-500 flex items-center gap-1 shrink-0">
            <Clock size={12} />
            {new Date(uploadLog.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {dirtyCount > 0 && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm">
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <span className="text-amber-800 font-medium">{dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}</span>
          <Button size="sm" variant="outline" onClick={saveAll} disabled={saving} className="ml-auto h-7 text-xs gap-1">
            <Save size={12} />Save Now
          </Button>
        </div>
      )}

      {/* ── Search & Filters ───────────────────────────────────────────── */}
      <SearchFilter
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employee name or ID..."
        branches={branches}
        branchFilter={filterBranch}
        onBranchChange={setFilterBranch}
        showBranchFilter
        sortOptions={SORT_OPTIONS}
        sortValue={sortValue}
        onSortChange={setSortValue}
        resultCount={displayed.length}
        resultLabel="employees"
        onExportCSV={exportCSV}
        exportLabel="Export CSV"
      />

      {/* ── Loading skeleton ───────────────────────────────────────────── */}
      {pageLoading && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 bg-gray-200 rounded" />
                <div className="h-2.5 w-24 bg-gray-100 rounded" />
              </div>
              {[80, 72, 72, 72, 56, 56, 72, 84].map((w, j) => (
                <div key={j} className="h-7 bg-gray-100 rounded hidden md:block" style={{ width: w }} />
              ))}
              <div className="h-10 w-full bg-gray-100 rounded md:hidden" />
            </div>
          ))}
        </div>
      )}

      {!pageLoading && (
        <>
          {/* ── DESKTOP TABLE (md+) ──────────────────────────────────────── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden mt-4">
            <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50/95 backdrop-blur border-b-2 border-gray-200 text-xs uppercase tracking-wide">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Employee</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">Branch</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Basic</th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-24">
                      Advance<br /><span className="normal-case font-normal text-gray-400 text-[10px]">(৳)</span>
                    </th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-24">
                      Leave<br /><span className="normal-case font-normal text-gray-400 text-[10px]">(days)</span>
                    </th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-28 hidden lg:table-cell">
                      Leave Adj.<br /><span className="normal-case font-normal text-gray-400 text-[10px]">Used / Left</span>
                    </th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-20">
                      Late<br /><span className="normal-case font-normal text-gray-400 text-[10px]">(days)</span>
                    </th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-20">
                      OT<br /><span className="normal-case font-normal text-gray-400 text-[10px]">(days)</span>
                    </th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-24">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <Checkbox checked={allChecked} data-state={!allChecked && someChecked ? 'indeterminate' : undefined} onCheckedChange={toggleAllBonus} className="shrink-0" />
                          <span>Att.</span>
                        </div>
                        <span className="normal-case font-normal text-gray-400 text-[10px]">Bonus</span>
                      </div>
                    </th>
                    <th className="text-center px-2 py-2.5 font-semibold text-gray-500 w-24 hidden lg:table-cell">
                      Conv.<br /><span className="normal-case font-normal text-gray-400 text-[10px]">(৳)</span>
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 hidden xl:table-cell" style={{ minWidth: 160 }}>Notes</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700 bg-blue-50/80 normal-case tracking-normal">Net Payable</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {displayed.map((row) => {
                    const rec = row.record as SalaryRecord
                    const calc = calcSalary(row.employee, { ...rec, leave_days_taken: rec.leave_days_taken ?? 0, leave_adjustment: rec.leave_adjustment ?? 0, conveyance: rec.conveyance ?? row.employee.conveyance })
                    const yearlyUsed = yearlyLeaveMap.get(row.employee.id) ?? 0
                    const yearlyRemaining = row.employee.yearly_leave_allowance - yearlyUsed
                    const bonusChecked = (rec.attendance_bonus ?? 0) === ATTENDANCE_BONUS_AMOUNT
                    return (
                      <tr key={row.employee.id} className={`hover:bg-gray-50/60 transition-colors ${row.dirty ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900 text-sm leading-tight">{row.employee.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{row.employee.designation}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs hidden lg:table-cell">{(row.employee.branch as unknown as Branch)?.name}</td>
                        <td className="px-3 py-2 text-right text-gray-700 text-sm whitespace-nowrap font-medium">{formatTaka(row.employee.basic_salary)}</td>
                        <td className="px-2 py-2">
                          <Input type="number" min="0" value={rec.advance_deducted ?? 0} onChange={e => update(row.employee.id, 'advance_deducted', +e.target.value)} className="text-right h-7 text-xs w-full min-w-[60px] border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" min="0" step="0.5" value={rec.leave_days_taken ?? 0} onChange={e => update(row.employee.id, 'leave_days_taken', +e.target.value)} className="text-right h-7 text-xs w-full min-w-[60px] border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                        </td>
                        <td className="px-2 py-2 hidden lg:table-cell">
                          <Input type="number" step="1" value={rec.leave_adjustment ?? 0} onChange={e => update(row.employee.id, 'leave_adjustment', +e.target.value)} className="text-right h-7 text-xs w-full min-w-[60px] border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                          <p className={`text-[10px] text-right mt-0.5 ${yearlyRemaining < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {yearlyUsed}d · {yearlyRemaining}d left
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" min="0" value={rec.late_days ?? 0} onChange={e => update(row.employee.id, 'late_days', +e.target.value)} className="text-right h-7 text-xs w-full min-w-[60px] border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" min="0" step="0.5" value={rec.ot_days ?? 0} onChange={e => update(row.employee.id, 'ot_days', +e.target.value)} className="text-right h-7 text-xs w-full min-w-[60px] border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Checkbox checked={bonusChecked} onCheckedChange={checked => update(row.employee.id, 'attendance_bonus', checked ? ATTENDANCE_BONUS_AMOUNT : 0)} className="border-gray-400" />
                        </td>
                        <td className="px-2 py-2 hidden lg:table-cell">
                          <Input type="number" min="0" value={rec.conveyance ?? row.employee.conveyance} onChange={e => update(row.employee.id, 'conveyance', +e.target.value)} className="text-right h-7 text-xs w-full min-w-[60px] border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                        </td>
                        <td className="px-3 py-2 hidden xl:table-cell align-top" style={{ minWidth: 160 }}>
                          <textarea
                            value={rec.notes ?? ''}
                            onChange={e => update(row.employee.id, 'notes', e.target.value)}
                            placeholder="Note..."
                            rows={2}
                            className="w-full min-w-[120px] min-h-[52px] text-xs px-2 py-1.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-blue-700 bg-blue-50/40 whitespace-nowrap text-sm">
                          {formatTaka(calc.net_payable)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {confirmDeleteRecId === row.employee.id ? (
                            <div className="flex flex-col items-center gap-1">
                              <button onClick={() => deleteRecord(row)} className="w-6 h-5 rounded text-[10px] bg-red-600 text-white hover:bg-red-700 leading-none">✓</button>
                              <button onClick={() => setConfirmDeleteRecId(null)} className="w-6 h-5 rounded text-[10px] bg-gray-100 text-gray-600 hover:bg-gray-200 leading-none">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteRecId(row.employee.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Clear this record">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {displayed.length === 0 && (
                    <tr>
                      <td colSpan={13} className="text-center py-16">
                        <Users size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-400 text-sm">No employees found</p>
                        <p className="text-gray-300 text-xs mt-1">Try changing filters or add employees first</p>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Summary footer */}
                {displayed.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50/80 border-t-2 border-gray-200 text-sm font-medium">
                      <td className="px-3 py-2.5 font-semibold text-gray-700" colSpan={2}>
                        Total ({totals.count} emp.)
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell" />
                      <td className="px-2 py-2.5 text-center text-red-600">{formatTaka(Math.round(totals.advance))}</td>
                      <td className="px-2 py-2.5 text-center text-red-600">{formatTaka(Math.round(totals.leave))}</td>
                      <td className="px-2 py-2.5 hidden lg:table-cell" />
                      <td className="px-2 py-2.5 text-center text-red-600">{formatTaka(Math.round(totals.late))}</td>
                      <td className="px-2 py-2.5 text-center text-green-600">{formatTaka(Math.round(totals.ot))}</td>
                      <td className="px-2 py-2.5 text-center text-green-600">{formatTaka(Math.round(totals.bonus))}</td>
                      <td className="px-2 py-2.5 text-center text-green-600 hidden lg:table-cell">{formatTaka(Math.round(totals.conveyance))}</td>
                      <td className="px-3 py-2.5 hidden xl:table-cell" />
                      <td className="px-3 py-2.5 text-right font-bold text-blue-800 bg-blue-50 text-base">{formatTaka(Math.round(totals.net))}</td>
                      <td className="px-2 py-2.5" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── MOBILE CARDS (< md) ──────────────────────────────────────── */}
          <div className="md:hidden mt-4 space-y-3">
            {displayed.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Users size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">No employees found</p>
                <p className="text-gray-300 text-xs mt-1">Try changing filters or add employees first</p>
              </div>
            )}
            {displayed.map((row) => {
              const rec = row.record as SalaryRecord
              const calc = calcSalary(row.employee, { ...rec, leave_days_taken: rec.leave_days_taken ?? 0, leave_adjustment: rec.leave_adjustment ?? 0, conveyance: rec.conveyance ?? row.employee.conveyance })
              const yearlyUsed = yearlyLeaveMap.get(row.employee.id) ?? 0
              const yearlyRemaining = row.employee.yearly_leave_allowance - yearlyUsed
              const bonusChecked = (rec.attendance_bonus ?? 0) === ATTENDANCE_BONUS_AMOUNT
              const branchName = (row.employee.branch as unknown as Branch)?.name
              return (
                <div key={row.employee.id} className={`bg-white rounded-xl border shadow-sm ${row.dirty ? 'border-amber-300' : 'border-gray-200'}`}>
                  {/* Card header */}
                  <div className={`flex items-start justify-between px-4 py-3 rounded-t-xl ${row.dirty ? 'bg-amber-50/50' : 'bg-gray-50/60'} border-b border-gray-100`}>
                    <div>
                      <p className="font-semibold text-gray-900">{row.employee.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{row.employee.designation}{branchName ? ` · ${branchName}` : ''}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Net Payable</p>
                      <p className="font-bold text-blue-700 text-lg leading-tight">{formatTaka(calc.net_payable)}</p>
                    </div>
                  </div>

                  {/* Input grid */}
                  <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Advance (৳)</label>
                      <Input type="number" min="0" value={rec.advance_deducted ?? 0} onChange={e => update(row.employee.id, 'advance_deducted', +e.target.value)} className="text-right h-8 text-sm border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Leave (days)</label>
                      <Input type="number" min="0" step="0.5" value={rec.leave_days_taken ?? 0} onChange={e => update(row.employee.id, 'leave_days_taken', +e.target.value)} className="text-right h-8 text-sm border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">
                        Leave Adj.
                        <span className={`ml-1 text-[10px] ${yearlyRemaining < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          ({yearlyUsed}d used, {yearlyRemaining}d left)
                        </span>
                      </label>
                      <Input type="number" step="1" value={rec.leave_adjustment ?? 0} onChange={e => update(row.employee.id, 'leave_adjustment', +e.target.value)} className="text-right h-8 text-sm border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Late (days)</label>
                      <Input type="number" min="0" value={rec.late_days ?? 0} onChange={e => update(row.employee.id, 'late_days', +e.target.value)} className="text-right h-8 text-sm border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">OT (days)</label>
                      <Input type="number" min="0" step="0.5" value={rec.ot_days ?? 0} onChange={e => update(row.employee.id, 'ot_days', +e.target.value)} className="text-right h-8 text-sm border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Conveyance (৳)</label>
                      <Input type="number" min="0" value={rec.conveyance ?? row.employee.conveyance} onChange={e => update(row.employee.id, 'conveyance', +e.target.value)} className="text-right h-8 text-sm border-gray-300 bg-white text-gray-900 focus:border-blue-500" />
                    </div>
                  </div>

                  {/* Attendance bonus + delete */}
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={bonusChecked} onCheckedChange={checked => update(row.employee.id, 'attendance_bonus', checked ? ATTENDANCE_BONUS_AMOUNT : 0)} className="border-gray-400" />
                      <span className="text-xs font-medium text-gray-600">
                        Attendance Bonus <span className="text-gray-400 font-normal">(৳{ATTENDANCE_BONUS_AMOUNT})</span>
                      </span>
                    </label>
                    {confirmDeleteRecId === row.employee.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-700 font-medium">Clear?</span>
                        <button onClick={() => deleteRecord(row)} className="px-2 py-0.5 rounded text-xs bg-red-600 text-white hover:bg-red-700">Yes</button>
                        <button onClick={() => setConfirmDeleteRecId(null)} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteRecId(row.employee.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                    <textarea
                      value={rec.notes ?? ''}
                      onChange={e => update(row.employee.id, 'notes', e.target.value)}
                      placeholder="Add a note..."
                      rows={2}
                      className="w-full min-h-[52px] text-sm px-2 py-1.5 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )
            })}

            {/* Mobile totals card */}
            {displayed.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Summary — {totals.count} employees</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Advance</span>
                    <span className="text-red-600 font-medium">{formatTaka(Math.round(totals.advance))}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Leave</span>
                    <span className="text-red-600 font-medium">{formatTaka(Math.round(totals.leave))}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Late</span>
                    <span className="text-red-600 font-medium">{formatTaka(Math.round(totals.late))}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">OT</span>
                    <span className="text-green-600 font-medium">{formatTaka(Math.round(totals.ot))}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Att. Bonus</span>
                    <span className="text-green-600 font-medium">{formatTaka(Math.round(totals.bonus))}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Conveyance</span>
                    <span className="text-green-600 font-medium">{formatTaka(Math.round(totals.conveyance))}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-semibold text-gray-700 text-sm">Total Net Payable</span>
                  <span className="text-xl font-bold text-blue-700">{formatTaka(Math.round(totals.net))}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function SalaryPage() {
  return <Suspense><SalaryContent /></Suspense>
}
