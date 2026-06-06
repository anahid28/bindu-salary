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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Row = {
  employee: Employee
  record: Partial<SalaryRecord>
  dirty: boolean
}

function SalaryContent() {
  const params = useSearchParams()
  const router = useRouter()
  const now = new Date()
  const [month, setMonth] = useState(+(params.get('month') ?? now.getMonth() + 1))
  const [year, setYear] = useState(+(params.get('year') ?? now.getFullYear()))
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [filterBranch, setFilterBranch] = useState('all')
  const [branches, setBranches] = useState<Branch[]>([])

  async function load() {
    const [{ data: emps }, { data: recs }, { data: brs }] = await Promise.all([
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true).order('name'),
      supabase.from('salary_records').select('*').eq('month', month).eq('year', year),
      supabase.from('branches').select('*').order('name'),
    ])
    const recMap = new Map((recs ?? []).map(r => [r.employee_id, r]))
    setRows((emps ?? []).map(emp => ({
      employee: emp as Employee,
      record: recMap.get(emp.id) ?? {
        employee_id: emp.id, month, year,
        advance_deducted: 0, leave_days_taken: 0, late_days: 0, ot_days: 0, attendance_bonus: 0, notes: '',
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
      late_days: r.record.late_days ?? 0,
      ot_days: r.record.ot_days ?? 0,
      attendance_bonus: r.record.attendance_bonus ?? 0,
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
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
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Basic</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Advance (৳)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Leave (days)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Late (days)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">OT (days)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Att. Bonus (৳)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700 bg-blue-50">Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row, i) => {
                const rec = row.record as SalaryRecord
                const calc = calcSalary(row.employee, { ...rec, leave_days_taken: rec.leave_days_taken ?? 0 })
                return (
                  <tr key={row.employee.id} className={`border-b border-gray-50 ${row.dirty ? 'bg-amber-50/40' : i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{row.employee.name}</p>
                      <p className="text-xs text-gray-400">{row.employee.designation}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{(row.employee.branch as unknown as Branch)?.name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatTaka(row.employee.basic_salary)}</td>
                    <td className="px-4 py-2.5">
                      <Input type="number" min="0" value={rec.advance_deducted ?? 0}
                        onChange={e => update(row.employee.id, 'advance_deducted', +e.target.value)}
                        className="text-right h-8 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input type="number" min="0" step="0.5" value={rec.leave_days_taken ?? 0}
                        onChange={e => update(row.employee.id, 'leave_days_taken', +e.target.value)}
                        className="text-right h-8 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input type="number" min="0" value={rec.late_days ?? 0}
                        onChange={e => update(row.employee.id, 'late_days', +e.target.value)}
                        className="text-right h-8 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input type="number" min="0" step="0.5" value={rec.ot_days ?? 0}
                        onChange={e => update(row.employee.id, 'ot_days', +e.target.value)}
                        className="text-right h-8 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <Input type="number" min="0" value={rec.attendance_bonus ?? 0}
                        onChange={e => update(row.employee.id, 'attendance_bonus', +e.target.value)}
                        className="text-right h-8 text-sm" />
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-blue-700 bg-blue-50/50">
                      {formatTaka(calc.net_payable)}
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No employees found</td></tr>
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
