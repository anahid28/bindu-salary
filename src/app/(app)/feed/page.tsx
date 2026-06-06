'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { SalaryUploadLog, Employee, SalaryRecord } from '@/types'
import { MONTHS } from '@/types'
import { calcSalary, formatTaka } from '@/lib/calculations'
import { CalendarDays, Upload, FileSpreadsheet, ChevronRight, Clock, Users, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

type MonthData = {
  month: number
  year: number
  records: number
  totalPayable: number
  log: SalaryUploadLog | null
  status: 'processed' | 'manual' | 'pending'
  completion: number // percentage
}

function FeedContent() {
  const params = useSearchParams()
  const router = useRouter()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const [year, setYear] = useState(+(params.get('year') ?? currentYear))
  const [months, setMonths] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')

  async function load() {
    setLoading(true)
    const [{ data: logs }, { data: recs }, { data: emps }, { count: empCount }] = await Promise.all([
      supabase.from('salary_upload_log').select('*').eq('year', year).order('month', { ascending: true }),
      supabase.from('salary_records').select('*, employee:employees(basic_salary, yearly_leave_allowance, conveyance)').eq('year', year),
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
    ])

    setTotalEmployees(empCount ?? 0)

    const logMap = new Map((logs ?? []).map(l => [l.month, l as SalaryUploadLog]))

    // Group salary records by month and calculate totals
    const recByMonth = new Map<number, { count: number; payable: number }>()
    const empMap = new Map((emps ?? []).map(e => [e.id, e as Employee]))

    for (const r of (recs ?? []) as (SalaryRecord & { employee?: Employee })[]) {
      const existing = recByMonth.get(r.month)
      let payable = 0
      if (r.employee) {
        const calc = calcSalary(r.employee, r)
        payable = calc.net_payable
      }
      if (existing) {
        existing.count++
        existing.payable += payable
      } else {
        recByMonth.set(r.month, { count: 1, payable })
      }
    }

    const monthData: MonthData[] = []
    for (let m = 1; m <= 12; m++) {
      const log = logMap.get(m) ?? null
      const recInfo = recByMonth.get(m)
      const records = recInfo?.count ?? 0
      const totalPayable = recInfo?.payable ?? 0
      const completion = totalEmployees > 0 ? Math.round((records / totalEmployees) * 100) : 0

      let status: 'processed' | 'manual' | 'pending' = 'pending'
      if (log && records > 0) status = 'processed'
      else if (records > 0) status = 'manual'

      monthData.push({ month: m, year, records, totalPayable, log, status, completion })
    }

    setMonths(monthData)
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  // Filter
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return months
    return months.filter(m => m.status === statusFilter)
  }, [months, statusFilter])

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  const processedCount = months.filter(m => m.status !== 'pending').length
  const totalRecords = months.reduce((s, m) => s + m.records, 0)
  const totalPayable = months.reduce((s, m) => s + m.totalPayable, 0)

  function formatRelative(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHrs < 24) return `${diffHrs}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Monthly Salary Feed</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {processedCount}/12 months processed · {totalRecords} records · {formatTaka(Math.round(totalPayable))} total in {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={v => setYear(+(v ?? year))}>
            <SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{processedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Done</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{12 - processedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Remaining</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{totalEmployees}</p>
          <p className="text-xs text-gray-500 mt-0.5">Staff</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-lg font-bold text-blue-700">{formatTaka(Math.round(totalPayable / 1000))}k</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {[
          { label: 'All', value: 'all', count: 12 },
          { label: 'Processed', value: 'processed', count: months.filter(m => m.status === 'processed').length },
          { label: 'Manual', value: 'manual', count: months.filter(m => m.status === 'manual').length },
          { label: 'Pending', value: 'pending', count: months.filter(m => m.status === 'pending').length },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === opt.value ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}<span className={`ml-1.5 ${statusFilter === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.count}</span>
          </button>
        ))}
      </div>

      {/* Timeline feed */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full skeleton shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 skeleton" />
                <div className="h-3 w-48 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const isCurrentMonth = m.month === currentMonth && m.year === currentYear
            return (
              <Link key={m.month} href={`/salary?month=${m.month}&year=${m.year}`} className="block group">
                <div className={`bg-white rounded-xl border p-4 sm:p-5 flex items-center gap-3 sm:gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                  isCurrentMonth ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    m.status === 'processed' ? 'bg-emerald-50' : m.status === 'manual' ? 'bg-blue-50' : 'bg-gray-100'
                  }`}>
                    {m.status === 'processed' ? <CheckCircle2 size={20} className="text-emerald-500" /> :
                     m.status === 'manual' ? <Circle size={20} className="text-blue-400" /> :
                     <Circle size={20} className="text-gray-300" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">{MONTHS[m.month - 1]}</p>
                      {isCurrentMonth && <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current</span>}
                      {m.status === 'processed' && <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full hidden sm:inline">Uploaded</span>}
                      {m.status === 'manual' && <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full hidden sm:inline">Manual</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      {m.records > 0 ? (
                        <>
                          <span className="flex items-center gap-1"><Users size={12} />{m.records} employee{m.records !== 1 ? 's' : ''}</span>
                          {m.totalPayable > 0 && <span className="font-medium text-gray-500">{formatTaka(Math.round(m.totalPayable))}</span>}
                          {m.log && <span className="flex items-center gap-1"><FileSpreadsheet size={12} /><span className="truncate max-w-[140px]">{m.log.file_name || 'Imported'}</span></span>}
                          {m.log && <span className="flex items-center gap-1"><Clock size={12} />{formatRelative(m.log.uploaded_at)}</span>}
                        </>
                      ) : (
                        <span className="text-gray-300">No records yet</span>
                      )}
                    </div>
                  </div>

                  {/* Completion percentage */}
                  {m.records > 0 && (
                    <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
                      <span className="text-xs font-semibold text-gray-500">{m.completion}%</span>
                      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${m.completion >= 100 ? 'bg-emerald-400' : m.completion >= 50 ? 'bg-blue-400' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(m.completion, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
              <p className="text-gray-400 text-sm">No months match the selected filter</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400 px-1">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Uploaded via Excel</span>
        <span className="flex items-center gap-1.5"><Circle size={14} className="text-blue-400" /> Manually entered</span>
        <span className="flex items-center gap-1.5"><Circle size={14} className="text-gray-300" /> Not processed</span>
      </div>
    </div>
  )
}

export default function FeedPage() {
  return <Suspense><FeedContent /></Suspense>
}
