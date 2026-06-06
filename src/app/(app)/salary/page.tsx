'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch, SalaryRecord } from '@/types'
import { MONTHS } from '@/types'
import { calcSalary, formatTaka } from '@/lib/calculations'
import { toast } from 'sonner'
import { Save, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ATTENDANCE_BONUS_AMOUNT = 700

type Row = {
  employee: Employee
  record: Partial<SalaryRecord>
  dirty: boolean
}

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
  // Map<employee_id, total leave days taken in selected year>
  const [yearlyLeaveMap, setYearlyLeaveMap] = useState<Map<string, number>>(new Map())

  async function load() {
    const [{ data: emps }, { data: recs }, { data: brs }, { data: yearRecs }] = await Promise.all([
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true).order('name'),
      supabase.from('salary_records').select('*').eq('month', month).eq('year', year),
      supabase.from('branches').select('*').order('name'),
      // All months in this year for leave balance
      supabase.from('salary_records').select('employee_id, leave_days_taken').eq('year', year),
    ])

    // Build yearly leave totals per employee
    const leaveMap = new Map<string, number>()
    for (const r of (yearRecs ?? [])) {
      leaveMap.set(r.employee_id, (leaveMap.get(r.employee_id) ?? 0) + (r.leave_days_taken ?? 0))
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

  const displayed = filterBranch === 'all' ? rows : rows.filter(r => r.employee.branch_id === filterBranch)

  // Master attendance bonus checkbox state
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

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-8 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Processing</h1>
          <p className="text-gray-500 text-sm mt-0.5">Input monthly data for each employee</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={v => setMonth(+(v ?? month))}>
            <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(+(v ?? year))}>
            <SelectTrigger className="w-24 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={saveAll} disabled={saving} className="gap-2">
            <Save size={15} />{saving ? 'Saving…' : 'Save All'}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/slips?month=${month}&year=${year}`)} className="gap-2">
            View Slips <ChevronRight size={15} />
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Select value={filterBranch} onValueChange={v => setFilterBranch(v ?? 'all')}>
          <SelectTrigger className="w-56 bg-white">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">Employee</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600 whitespace-nowrap">Branch</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 whitespace-nowrap">Basic</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-24 whitespace-nowrap">Advance (৳)</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-28 whitespace-nowrap">
                  <div>Leave (days)</div>
                  <div className="text-xs font-normal text-gray-400">Used / Left of {new Date(year, 0).getFullYear()} allowance</div>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-24 whitespace-nowrap">
                  <div>Leave Adj.</div>
                  <div className="text-xs font-normal text-gray-400">(±days)</div>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-24 whitespace-nowrap">Late (days)</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-24 whitespace-nowrap">OT (days)</th>
                <th className="px-3 py-3 font-medium text-gray-600 w-28 whitespace-nowrap">
                  <div className="flex items-center gap-2 justify-center">
                    <Checkbox
                      checked={allChecked}
                      data-state={!allChecked && someChecked ? 'indeterminate' : undefined}
                      onCheckedChange={toggleAllBonus}
                      className="shrink-0"
                    />
                    <span>Att. Bonus<br /><span className="text-xs font-normal text-gray-400">(৳{ATTENDANCE_BONUS_AMOUNT})</span></span>
                  </div>
                </th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-28 whitespace-nowrap">Conveyance (৳)</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-700 bg-blue-50 whitespace-nowrap">Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, i) => {
                const rec = row.record as SalaryRecord
                const calc = calcSalary(row.employee, {
                  ...rec,
                  leave_days_taken: rec.leave_days_taken ?? 0,
                  leave_adjustment: rec.leave_adjustment ?? 0,
                  conveyance: rec.conveyance ?? row.employee.conveyance,
                })
                const yearlyUsed = yearlyLeaveMap.get(row.employee.id) ?? 0
                const yearlyRemaining = row.employee.yearly_leave_allowance - yearlyUsed
                const bonusChecked = (rec.attendance_bonus ?? 0) === ATTENDANCE_BONUS_AMOUNT
                return (
                  <tr key={row.employee.id} className={`border-b border-gray-50 ${row.dirty ? 'bg-amber-50/40' : i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{row.employee.name}</p>
                      <p className="text-xs text-gray-400">{row.employee.designation}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{(row.employee.branch as unknown as Branch)?.name}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatTaka(row.employee.basic_salary)}</td>
                    <td className="px-3 py-2.5">
                      <Input type="number" min="0" value={rec.advance_deducted ?? 0}
                        onChange={e => update(row.employee.id, 'advance_deducted', +e.target.value)}
                        className="text-right h-8 text-sm w-24" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-end gap-1">
                        <Input type="number" min="0" step="0.5" value={rec.leave_days_taken ?? 0}
                          onChange={e => update(row.employee.id, 'leave_days_taken', +e.target.value)}
                          className="text-right h-8 text-sm w-20" />
                        <span className={`text-xs ${yearlyRemaining < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {yearlyUsed}d used · {yearlyRemaining}d left
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" step="1" value={rec.leave_adjustment ?? 0}
                        onChange={e => update(row.employee.id, 'leave_adjustment', +e.target.value)}
                        title="Positive = grant extra leave, Negative = extra deduction"
                        className="text-right h-8 text-sm w-20" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" min="0" value={rec.late_days ?? 0}
                        onChange={e => update(row.employee.id, 'late_days', +e.target.value)}
                        className="text-right h-8 text-sm w-20" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" min="0" step="0.5" value={rec.ot_days ?? 0}
                        onChange={e => update(row.employee.id, 'ot_days', +e.target.value)}
                        className="text-right h-8 text-sm w-20" />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Checkbox
                        checked={bonusChecked}
                        onCheckedChange={checked => update(row.employee.id, 'attendance_bonus', checked ? ATTENDANCE_BONUS_AMOUNT : 0)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" min="0" value={rec.conveyance ?? row.employee.conveyance}
                        onChange={e => update(row.employee.id, 'conveyance', +e.target.value)}
                        className="text-right h-8 text-sm w-24" />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-blue-700 bg-blue-50/50 whitespace-nowrap">
                      {formatTaka(calc.net_payable)}
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-gray-400">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function SalaryPage() {
  return <Suspense><SalaryContent /></Suspense>
}
