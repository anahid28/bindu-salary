'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch, SalaryRecord, SalaryCalc } from '@/types'
import { MONTHS } from '@/types'
import { calcSalary, formatTaka } from '@/lib/calculations'
import { Users, Building2, DollarSign, FileText, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'

type BranchSummary = {
  branch: Branch
  calcs: SalaryCalc[]
  totalBasic: number
  totalDeductions: number
  totalAdditions: number
  totalPayable: number
}

export default function Dashboard() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [branchSummaries, setBranchSummaries] = useState<BranchSummary[]>([])
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [totalBranches, setTotalBranches] = useState(0)
  const [totalBasicBill, setTotalBasicBill] = useState(0)
  const [totalPayable, setTotalPayable] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: emps }, { data: recs }, { data: brs }] = await Promise.all([
        supabase.from('employees').select('*, branch:branches(*)').eq('active', true),
        supabase.from('salary_records').select('*').eq('month', currentMonth).eq('year', currentYear),
        supabase.from('branches').select('*').order('name'),
      ])

      const recMap = new Map((recs ?? []).map(r => [r.employee_id, r as SalaryRecord]))
      const branchMap = new Map<string, { branch: Branch; calcs: SalaryCalc[] }>()

      for (const emp of (emps ?? []) as Employee[]) {
        const rec = recMap.get(emp.id) ?? {
          id: '', employee_id: emp.id, month: currentMonth, year: currentYear,
          advance_deducted: 0, leave_days_taken: 0, leave_adjustment: 0,
          late_days: 0, ot_days: 0, attendance_bonus: 0, notes: '', created_at: '',
        } as SalaryRecord
        const calc = calcSalary(emp, rec)
        const bid = emp.branch_id ?? 'unassigned'
        if (!branchMap.has(bid)) {
          const branch = (emp.branch as unknown as Branch) ?? { id: bid, name: 'Unassigned', created_at: '' }
          branchMap.set(bid, { branch, calcs: [] })
        }
        branchMap.get(bid)!.calcs.push(calc)
      }

      const summaries: BranchSummary[] = []
      for (const { branch, calcs } of branchMap.values()) {
        const totalBasic = calcs.reduce((s, c) => s + c.basic_salary, 0)
        const totalDeductions = calcs.reduce((s, c) => s + c.advance_deducted + c.leave_deduction + c.late_deduction, 0)
        const totalAdditions = calcs.reduce((s, c) => s + c.ot_addition + c.conveyance + c.attendance_bonus, 0)
        const totalPayable = calcs.reduce((s, c) => s + c.net_payable, 0)
        summaries.push({ branch, calcs, totalBasic, totalDeductions, totalAdditions, totalPayable })
      }

      // Sort summaries to match branches order
      const branchOrder = new Map((brs ?? []).map((b, i) => [b.id, i]))
      summaries.sort((a, b) => (branchOrder.get(a.branch.id) ?? 99) - (branchOrder.get(b.branch.id) ?? 99))

      setBranchSummaries(summaries)
      setTotalEmployees((emps ?? []).length)
      setTotalBranches((brs ?? []).length)
      setTotalBasicBill(summaries.reduce((s, b) => s + b.totalBasic, 0))
      setTotalPayable(summaries.reduce((s, b) => s + b.totalPayable, 0))
      setLoading(false)
    }
    load()
  }, [currentMonth, currentYear])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {MONTHS[currentMonth - 1]} {currentYear} — Bindu Premium Salary Manager
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
            <p className="text-sm text-gray-500">Active Employees</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalBranches}</p>
            <p className="text-sm text-gray-500">Branches</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-violet-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{loading ? '…' : formatTaka(totalBasicBill)}</p>
            <p className="text-sm text-gray-500">Total Basic Bill</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-teal-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-teal-700 leading-tight">{loading ? '…' : formatTaka(totalPayable)}</p>
            <p className="text-sm text-gray-500">Total Payable</p>
          </div>
        </div>
      </div>

      {/* Branch-wise Analytics */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-700 mb-3">
          Branch-wise Payroll — {MONTHS[currentMonth - 1]} {currentYear}
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading analytics…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Staff</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total Basic</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      <span className="flex items-center justify-end gap-1"><TrendingDown size={13} className="text-red-400" />Deductions</span>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      <span className="flex items-center justify-end gap-1"><TrendingUp size={13} className="text-green-500" />Additions</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 bg-blue-50">Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {branchSummaries.map((s, i) => (
                    <tr key={s.branch.id} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.branch.name}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{s.calcs.length}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatTaka(s.totalBasic)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{s.totalDeductions > 0 ? `-${formatTaka(Math.round(s.totalDeductions))}` : '—'}</td>
                      <td className="px-4 py-3 text-right text-green-600">+{formatTaka(Math.round(s.totalAdditions))}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/50">{formatTaka(s.totalPayable)}</td>
                    </tr>
                  ))}
                  {branchSummaries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No salary data for this month yet — process salaries first.</td></tr>
                  )}
                  {branchSummaries.length > 0 && (
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-4 py-3 font-semibold text-gray-800">Total</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">{totalEmployees}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatTaka(totalBasicBill)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        -{formatTaka(Math.round(branchSummaries.reduce((s, b) => s + b.totalDeductions, 0)))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">
                        +{formatTaka(Math.round(branchSummaries.reduce((s, b) => s + b.totalAdditions, 0)))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-800 bg-blue-50 text-base">{formatTaka(totalPayable)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-3">
        {[
          {
            href: `/salary?month=${currentMonth}&year=${currentYear}`,
            icon: DollarSign,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            title: `Process ${MONTHS[currentMonth - 1]} ${currentYear} Salary`,
            desc: 'Input advance, leave, late & OT for all employees',
          },
          {
            href: `/slips?month=${currentMonth}&year=${currentYear}`,
            icon: FileText,
            color: 'text-teal-600',
            bg: 'bg-teal-50',
            title: 'View & Print Salary Slips',
            desc: 'Branch-wise salary slips, preview or download PDF',
          },
          {
            href: '/employees',
            icon: Users,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            title: 'Manage Employees',
            desc: 'Add, edit or deactivate employees',
          },
          {
            href: '/eid',
            icon: FileText,
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            title: 'Eid Bonus Sheet',
            desc: 'Process Eid salary payment + bonus',
          },
        ].map(({ href, icon: Icon, color, bg, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
