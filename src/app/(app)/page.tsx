'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch, SalaryRecord, SalaryCalc } from '@/types'
import { MONTHS } from '@/types'
import { calcSalary, formatTaka } from '@/lib/calculations'
import { Users, Building2, DollarSign, FileText, ArrowRight, TrendingDown, TrendingUp, CalendarDays, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type BranchSummary = {
  branch: Branch
  calcs: SalaryCalc[]
  totalBasic: number
  totalDeductions: number
  totalAdditions: number
  totalPayable: number
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 p-5 bg-white">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-lg skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-20 skeleton" />
          <div className="h-4 w-28 skeleton" />
        </div>
      </div>
    </div>
  )
}

function SkeletonTableRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3"><div className="h-4 w-28 skeleton" /></td>
          <td className="px-4 py-3"><div className="h-4 w-8 skeleton ml-auto" /></td>
          <td className="px-4 py-3"><div className="h-4 w-20 skeleton ml-auto" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 skeleton ml-auto" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 skeleton ml-auto" /></td>
          <td className="px-4 py-3"><div className="h-4 w-20 skeleton ml-auto" /></td>
        </tr>
      ))}
    </>
  )
}

function DashboardContent() {
  const params = useSearchParams()
  const router = useRouter()
  const now = new Date()
  const currentYear = now.getFullYear()
  const defaultMonth = +(params.get('month') ?? now.getMonth() + 1)
  const defaultYear = +(params.get('year') ?? currentYear)
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)

  const [branchSummaries, setBranchSummaries] = useState<BranchSummary[]>([])
  const [prevSummaries, setPrevSummaries] = useState<BranchSummary[]>([])
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [totalBranches, setTotalBranches] = useState(0)
  const [totalBasicBill, setTotalBasicBill] = useState(0)
  const [totalPayable, setTotalPayable] = useState(0)
  const [prevTotalPayable, setPrevTotalPayable] = useState(0)
  const [prevTotalEmployees, setPrevTotalEmployees] = useState(0)
  const [loading, setLoading] = useState(true)

  // Previous month
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  async function loadData(m: number, y: number) {
    const [{ data: emps }, { data: recs }, { data: brs }] = await Promise.all([
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true),
      supabase.from('salary_records').select('*').eq('month', m).eq('year', y),
      supabase.from('branches').select('*').order('name'),
    ])

    const recMap = new Map((recs ?? []).map(r => [r.employee_id, r as SalaryRecord]))
    const branchMap = new Map<string, { branch: Branch; calcs: SalaryCalc[] }>()

    for (const emp of (emps ?? []) as Employee[]) {
      const rec = recMap.get(emp.id) ?? {
        id: '', employee_id: emp.id, month: m, year: y,
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

    const branchOrder = new Map((brs ?? []).map((b, i) => [b.id, i]))
    summaries.sort((a, b) => (branchOrder.get(a.branch.id) ?? 99) - (branchOrder.get(b.branch.id) ?? 99))

    return { summaries, empCount: (emps ?? []).length, branchCount: (brs ?? []).length }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [current, prev] = await Promise.all([
        loadData(month, year),
        loadData(prevMonth, prevYear),
      ])

      setBranchSummaries(current.summaries)
      setTotalEmployees(current.empCount)
      setTotalBranches(current.branchCount)
      setTotalBasicBill(current.summaries.reduce((s, b) => s + b.totalBasic, 0))
      setTotalPayable(current.summaries.reduce((s, b) => s + b.totalPayable, 0))

      setPrevSummaries(prev.summaries)
      setPrevTotalPayable(prev.summaries.reduce((s, b) => s + b.totalPayable, 0))
      setPrevTotalEmployees(prev.empCount)
      setLoading(false)
    }
    load()
  }, [month, year])

  function trendPct(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const payableTrend = trendPct(totalPayable, prevTotalPayable)
  const empTrend = trendPct(totalEmployees, prevTotalEmployees)

  const maxPayable = Math.max(...branchSummaries.map(s => s.totalPayable), 1)

  const statCards = [
    {
      label: 'Active Employees',
      value: totalEmployees,
      trend: empTrend,
      icon: Users,
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Branches',
      value: totalBranches,
      trend: null,
      icon: Building2,
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Total Basic Bill',
      value: formatTaka(totalBasicBill),
      trend: null,
      icon: DollarSign,
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      isMoney: true,
    },
    {
      label: 'Total Payable',
      value: formatTaka(totalPayable),
      trend: payableTrend,
      icon: DollarSign,
      bg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      isMoney: true,
      highlight: true,
    },
  ]

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Bindu Premium Salary Manager</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(+(v ?? month))}>
            <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(+(v ?? year))}>
            <SelectTrigger className="w-24 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
              <div key={card.label} className="group bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon size={18} className={`sm:w-5 sm:h-5 ${card.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-gray-900 leading-tight truncate ${card.isMoney ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>
                      {card.value}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{card.label}</p>
                      {card.trend !== null && card.trend !== 0 && (
                        <span className={`flex items-center text-[10px] font-semibold ${card.trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {card.trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {Math.abs(card.trend)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
        }
      </div>

      {/* Employees by Branch - Horizontal Bar Chart */}
      {!loading && branchSummaries.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">Employees by Branch</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-2.5">
            {branchSummaries.map(s => {
              const pct = Math.round((s.calcs.length / Math.max(totalEmployees, 1)) * 100)
              return (
                <div key={s.branch.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 sm:w-36 truncate text-right shrink-0">{s.branch.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    >
                      <span className="text-[10px] font-bold text-white">{s.calcs.length}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Branch-wise Table */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">
          Branch-wise Payroll — {MONTHS[month - 1]} {year}
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Branch</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Staff</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Total Basic</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Deductions</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Additions</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide bg-blue-50">Net Payable</th>
                  </tr>
                </thead>
                <tbody><SkeletonTableRows count={5} /></tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Branch</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Staff</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Total Basic</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1 justify-end"><TrendingDown size={12} className="text-red-400" />Deductions</span>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1 justify-end"><TrendingUp size={12} className="text-green-500" />Additions</span>
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide bg-blue-50">Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {branchSummaries.map((s) => (
                    <tr
                      key={s.branch.id}
                      onClick={() => router.push(`/salary?month=${month}&year=${year}`)}
                      className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        {s.branch.name}
                        <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{s.calcs.length}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatTaka(s.totalBasic)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{s.totalDeductions > 0 ? `-${formatTaka(Math.round(s.totalDeductions))}` : '—'}</td>
                      <td className="px-4 py-3 text-right text-green-600">+{formatTaka(Math.round(s.totalAdditions))}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/50">{formatTaka(s.totalPayable)}</td>
                    </tr>
                  ))}
                  {branchSummaries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-400 text-sm">No salary data for {MONTHS[month - 1]} {year}</p>
                        <p className="text-gray-300 text-xs mt-1">Process salaries first from the Salary Processing page</p>
                      </td>
                    </tr>
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
      <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { href: `/salary?month=${month}&year=${year}`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-l-indigo-400', title: `Process ${MONTHS[month - 1]} ${year} Salary`, desc: 'Input advance, leave, late & OT for all employees' },
          { href: `/slips?month=${month}&year=${year}`, icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-l-teal-400', title: 'View & Print Salary Slips', desc: 'Branch-wise salary slips, preview or download PDF' },
          { href: '/employees', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-l-orange-400', title: 'Manage Employees', desc: 'Add, edit or deactivate employees' },
          { href: '/eid', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-l-rose-400', title: 'Eid Bonus Sheet', desc: 'Process Eid salary payment + bonus' },
          { href: `/feed?year=${year}`, icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-l-emerald-400', title: 'Monthly Salary Feed', desc: 'View upload history & monthly status' },
        ].map(({ href, icon: Icon, color, bg, border, title, desc }) => (
          <Link key={href} href={href} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${border} p-4 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group`}>
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return <Suspense><DashboardContent /></Suspense>
}
