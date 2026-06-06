'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch, SalaryRecord, Settings, SalaryCalc } from '@/types'
import { MONTHS } from '@/types'
import { calcSalary, formatTaka } from '@/lib/calculations'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SlipPreviewButton } from '@/components/salary/SlipPreviewModal'

function SlipsContent() {
  const params = useSearchParams()
  const now = new Date()
  const currentYear = now.getFullYear()
  const [month, setMonth] = useState(+(params.get('month') ?? now.getMonth() + 1))
  const [year, setYear] = useState(+(params.get('year') ?? currentYear))
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [calcsByBranch, setCalcsByBranch] = useState<Map<string, SalaryCalc[]>>(new Map())
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const [{ data: emps }, { data: recs }, { data: brs }, { data: sett }] = await Promise.all([
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true),
      supabase.from('salary_records').select('*').eq('month', month).eq('year', year),
      supabase.from('branches').select('*').order('name'),
      supabase.from('settings').select('*').limit(1).single(),
    ])
    const recMap = new Map((recs ?? []).map(r => [r.employee_id, r as SalaryRecord]))
    const map = new Map<string, SalaryCalc[]>()
    for (const emp of (emps ?? []) as Employee[]) {
      const rec = recMap.get(emp.id) ?? {
        id: '', employee_id: emp.id, month, year,
        advance_deducted: 0, leave_days_taken: 0, leave_adjustment: 0,
        late_days: 0, ot_days: 0, attendance_bonus: 0, notes: '', created_at: '',
      } as SalaryRecord
      const calc = calcSalary(emp, rec)
      const bid = emp.branch_id ?? 'unassigned'
      if (!map.has(bid)) map.set(bid, [])
      map.get(bid)!.push(calc)
    }
    setCalcsByBranch(map)
    setBranches(brs ?? [])
    if (sett) setSettings(sett as Settings)
  }

  useEffect(() => { load() }, [month, year])

  async function downloadBranch(branchId: string, branchName: string) {
    const calcs = calcsByBranch.get(branchId) ?? []
    if (!calcs.length) { toast.error('No employees in this branch'); return }
    setLoading(true)
    try {
      const { downloadPDF } = await import('@/components/salary/SalarySlipPDF')
      await downloadPDF({
        calcs,
        month, year,
        generatedBy: settings?.generated_by ?? 'Nahid',
        paymentBy: settings?.payment_by ?? '',
        companyName: settings?.company_name ?? 'Bindu Premium',
      }, `${branchName}-${MONTHS[month - 1]}-${year}.pdf`)
    } catch {
      toast.error('PDF generation failed')
    }
    setLoading(false)
  }

  async function downloadAll() {
    const allCalcs = Array.from(calcsByBranch.values()).flat()
    if (!allCalcs.length) { toast.error('No salary data for this month'); return }
    setLoading(true)
    try {
      const { downloadPDF } = await import('@/components/salary/SalarySlipPDF')
      await downloadPDF({
        calcs: allCalcs,
        month, year,
        generatedBy: settings?.generated_by ?? 'Nahid',
        paymentBy: settings?.payment_by ?? '',
        companyName: settings?.company_name ?? 'Bindu Premium',
      }, `All-Branches-${MONTHS[month - 1]}-${year}.pdf`)
    } catch {
      toast.error('PDF generation failed')
    }
    setLoading(false)
  }

  const displayedBranches = selectedBranch === 'all'
    ? branches
    : branches.filter(b => b.id === selectedBranch)

  const totalPayable = Array.from(calcsByBranch.values()).flat().reduce((s, c) => s + c.net_payable, 0)
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Slips</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {MONTHS[month - 1]} {year} · Total Payable: <span className="font-semibold text-gray-700">{formatTaka(totalPayable)}</span>
          </p>
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
          <Button onClick={downloadAll} disabled={loading} className="gap-2">
            <Download size={15} />
            {loading ? 'Generating…' : 'Download All'}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Select value={selectedBranch} onValueChange={v => setSelectedBranch(v ?? 'all')}>
          <SelectTrigger className="w-56 bg-white">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {displayedBranches.map(branch => {
          const calcs = calcsByBranch.get(branch.id) ?? []
          const branchTotal = calcs.reduce((s, c) => s + c.net_payable, 0)
          return (
            <div key={branch.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-gray-800">{branch.name}</h2>
                  <Badge variant="secondary">{calcs.length} employees</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">{formatTaka(branchTotal)}</span>
                  <Button size="sm" variant="outline" onClick={() => downloadBranch(branch.id, branch.name)} disabled={loading} className="gap-1.5">
                    <Download size={13} />PDF
                  </Button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Employee</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Basic</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Advance</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Leave</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Late</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">OT</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Conveyance</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-700 text-xs">Net Payable</th>
                    <th className="px-2 py-2.5 text-xs w-8" />
                  </tr>
                </thead>
                <tbody>
                  {calcs.map((calc, i) => (
                    <tr key={calc.employee.id} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{calc.employee.name}</p>
                        <p className="text-xs text-gray-400">{calc.employee.designation}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatTaka(calc.basic_salary)}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{calc.advance_deducted > 0 ? `-${formatTaka(calc.advance_deducted)}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{calc.leave_deduction > 0 ? `-${formatTaka(Math.round(calc.leave_deduction))}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{calc.late_deduction > 0 ? `-${formatTaka(Math.round(calc.late_deduction))}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{calc.ot_addition > 0 ? `+${formatTaka(Math.round(calc.ot_addition))}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">+{formatTaka(calc.conveyance)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-700">{formatTaka(calc.net_payable)}</td>
                      <td className="px-2 py-2.5">
                        <SlipPreviewButton calc={calc} month={month} year={year} settings={settings} />
                      </td>
                    </tr>
                  ))}
                  {calcs.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-6 text-gray-400 text-xs">No employees in this branch</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SlipsPage() {
  return <Suspense><SlipsContent /></Suspense>
}
