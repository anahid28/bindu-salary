'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch, EidRecord, Settings, EidCalc } from '@/types'
import { calcEid, formatTaka } from '@/lib/calculations'
import { toast } from 'sonner'
import { Save, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type EidRow = { employee: Employee; record: Partial<EidRecord>; dirty: boolean }

export default function EidPage() {
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [title] = useState(`Eid ul Adha Bonus ${now.getFullYear()}`)
  const [rows, setRows] = useState<EidRow[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])

  async function load() {
    const [{ data: emps }, { data: recs }, { data: sett }, { data: brs }] = await Promise.all([
      supabase.from('employees').select('*, branch:branches(*)').eq('active', true).order('name'),
      supabase.from('eid_records').select('*').eq('year', year).eq('title', title),
      supabase.from('settings').select('*').limit(1).single(),
      supabase.from('branches').select('*').order('name'),
    ])
    const recMap = new Map((recs ?? []).map(r => [r.employee_id, r as EidRecord]))
    setRows((emps ?? []).map(emp => ({
      employee: emp as Employee,
      record: recMap.get(emp.id) ?? {
        employee_id: emp.id, year, title,
        salary_payment_pct: 50, advance_deducted: 0, eid_bonus_pct: 50,
      },
      dirty: false,
    })))
    if (sett) setSettings(sett as Settings)
    setBranches(brs ?? [])
  }

  useEffect(() => { load() }, [])

  function update(empId: string, field: keyof EidRecord, value: number | string) {
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
      year: r.record.year,
      title: r.record.title,
      salary_payment_pct: r.record.salary_payment_pct ?? 50,
      advance_deducted: r.record.advance_deducted ?? 0,
      eid_bonus_pct: r.record.eid_bonus_pct ?? 50,
    }))
    const { error } = await supabase.from('eid_records').upsert(upserts, { onConflict: 'employee_id,year,title' })
    if (error) toast.error(error.message)
    else { toast.success('Saved'); setRows(prev => prev.map(r => ({ ...r, dirty: false }))) }
    setSaving(false)
  }

  async function downloadPDFs() {
    const calcs: EidCalc[] = rows.map(r => calcEid(r.employee, r.record as EidRecord))
    if (!calcs.length) { toast.error('No data'); return }
    setLoading(true)
    try {
      const { downloadEidPDF } = await import('@/components/salary/EidSlipPDF')
      await downloadEidPDF({
        calcs, title,
        generatedBy: settings?.generated_by ?? 'Nahid',
        paymentBy: settings?.payment_by ?? '',
        companyName: settings?.company_name ?? 'Bindu Premium',
      }, `Eid-Bonus-${year}.pdf`)
    } catch (e) {
      toast.error('PDF generation failed')
    }
    setLoading(false)
  }

  const totalPayable = rows.reduce((s, r) => s + calcEid(r.employee, r.record as EidRecord).net_payable, 0)

  const grouped = branches.map(b => ({
    branch: b,
    rows: rows.filter(r => r.employee.branch_id === b.id),
  })).filter(g => g.rows.length > 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Eid Bonus Sheet</h1>
          <p className="text-gray-500 text-sm mt-0.5">{title} · Total: <span className="font-semibold text-gray-700">{formatTaka(totalPayable)}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={saveAll} disabled={saving} variant="outline" className="gap-2">
            <Save size={15} />{saving ? 'Saving…' : 'Save All'}
          </Button>
          <Button onClick={downloadPDFs} disabled={loading} className="gap-2">
            <Download size={15} />{loading ? 'Generating…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm text-amber-800">
        <strong>Note:</strong> Conveyance, Leave, Late, Attendance Bonus & OT are excluded — they will be calculated and adjusted at final due payment time.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Salary</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Salary Pay %</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Salary Payment</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Advance (৳)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Eid Bonus %</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Eid Bonus</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 bg-rose-50 w-32">Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rec = row.record as EidRecord
                const calc = calcEid(row.employee, rec)
                return (
                  <tr key={row.employee.id} className={`border-b border-gray-50 ${row.dirty ? 'bg-amber-50/40' : i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{row.employee.name}</p>
                      <p className="text-xs text-gray-400">{row.employee.designation} · {(row.employee.branch as unknown as Branch)?.name}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatTaka(row.employee.basic_salary)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Input type="number" min="0" max="100" value={rec.salary_payment_pct ?? 50}
                          onChange={e => update(row.employee.id, 'salary_payment_pct', +e.target.value)}
                          className="text-right h-8 text-sm w-16" />
                        <span className="text-gray-500 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatTaka(calc.salary_payment)}</td>
                    <td className="px-4 py-2.5">
                      <Input type="number" min="0" value={rec.advance_deducted ?? 0}
                        onChange={e => update(row.employee.id, 'advance_deducted', +e.target.value)}
                        className="text-right h-8 text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Input type="number" min="0" max="200" value={rec.eid_bonus_pct ?? 50}
                          onChange={e => update(row.employee.id, 'eid_bonus_pct', +e.target.value)}
                          className="text-right h-8 text-sm w-16" />
                        <span className="text-gray-500 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-medium">+{formatTaka(calc.eid_bonus)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-rose-700 bg-rose-50/50">{formatTaka(calc.net_payable)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
