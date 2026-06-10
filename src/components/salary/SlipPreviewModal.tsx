'use client'

import { useState } from 'react'
import type { SalaryCalc, Settings } from '@/types'
import { MONTHS } from '@/types'
import { formatTaka } from '@/lib/calculations'
import { BINDU_LOGO } from '@/lib/logo-base64'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Eye } from 'lucide-react'
import { toast } from 'sonner'

function fmt(n: number) {
  return n === 0 ? '0' : n.toLocaleString('en-BD')
}

type SlipPreviewProps = {
  calc: SalaryCalc
  month: number
  year: number
  settings: Settings | null
}

function SlipPreview({ calc, month, year, settings }: SlipPreviewProps) {
  const { employee: emp, record, basic_salary, advance_deducted,
    leave_deduction, late_deduction, ot_addition, conveyance,
    attendance_bonus, net_payable } = calc

  const monthName = `${MONTHS[month - 1]} ${year}`
  const branchName = (emp.branch as unknown as { name: string })?.name ?? ''
  const deductible_leave = Math.max(0, (record.leave_days_taken ?? 0) - emp.yearly_leave_allowance - (record.leave_adjustment ?? 0))
  const sub1 = basic_salary - advance_deducted
  const sub2 = sub1 - Math.round(leave_deduction) - Math.round(late_deduction)
  const sub3 = sub2 + attendance_bonus

  const row = (label: string, qty: string, op: string, amount: number, bold = false, underline = false) => (
    <tr className="border-b border-gray-200">
      <td className="px-3 py-2 text-sm">{label}</td>
      <td className="px-2 py-2 text-center text-sm border-l border-gray-200 w-10">{qty}</td>
      <td className="px-2 py-2 text-center text-sm border-l border-gray-200 w-8">{op}</td>
      <td className={`px-3 py-2 text-right text-sm border-l border-gray-200 w-20 ${bold ? 'font-bold' : ''} ${underline ? 'underline decoration-gray-700' : ''}`}>
        {fmt(amount)}
      </td>
    </tr>
  )

  const subtotalRow = (value: number) => (
    <tr className="border-b border-gray-200">
      <td className="px-3 py-1.5" />
      <td className="px-2 py-1.5 border-l border-gray-200" />
      <td className="px-2 py-1.5 text-center text-sm border-l border-gray-200">(=)</td>
      <td className="px-3 py-1.5 text-right font-bold underline text-sm border-l border-gray-200">{fmt(Math.round(value))}</td>
    </tr>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-sm mx-auto text-gray-800 font-sans">
      {/* Logo */}
      <div className="flex justify-center mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BINDU_LOGO} alt="Bindu Premium" className="h-9 object-contain" />
      </div>

      {/* Title */}
      <p className="text-center text-xs tracking-widest text-gray-600 mb-2">SALARY SHEET</p>

      {/* Month box */}
      <div className="bg-gray-100 text-center font-bold italic text-sm py-2 px-3 mb-3 rounded">
        {monthName}
      </div>

      {/* Employee */}
      <p className="font-bold text-base text-gray-900 mb-1">{emp.name}</p>
      <div className="flex justify-between text-xs text-gray-600 mb-3">
        <span>Designation: <strong>{emp.designation}{branchName ? ` (${branchName})` : ''}</strong></span>
        <span>ID NO: <strong>{emp.employee_id}</strong></span>
      </div>

      {/* Table */}
      <table className="w-full border border-gray-200 rounded overflow-hidden text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200">
            <th className="text-left px-3 py-2 italic font-normal">Description</th>
            <th className="text-center px-2 py-2 italic font-normal border-l border-gray-200 w-10">QTY</th>
            <th className="px-2 py-2 border-l border-gray-200 w-8" />
            <th className="text-right px-3 py-2 italic font-normal border-l border-gray-200 w-20">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* Salary */}
          <tr className="border-b border-gray-200">
            <td className="px-3 py-2 text-sm">Salary</td>
            <td className="px-2 py-2 border-l border-gray-200" />
            <td className="px-2 py-2 border-l border-gray-200" />
            <td className="px-3 py-2 text-right font-bold text-sm border-l border-gray-200">{fmt(basic_salary)}</td>
          </tr>
          {row('Advance Received', '', '(-)', advance_deducted)}
          {subtotalRow(sub1)}
          <tr className="border-b border-gray-200">
            <td className="px-3 py-2 text-sm">
              {`Leave: ${record.leave_days_taken ?? 0}, Less from yearly leave ${record.leave_adjustment ?? 0}, Used: ${calc.yearly_used_leave ?? 0}, Left ${emp.yearly_leave_allowance - (calc.yearly_used_leave ?? 0)}`}
            </td>
            <td className="px-2 py-2 text-center text-sm border-l border-gray-200">{deductible_leave > 0 ? deductible_leave : '0'}</td>
            <td className="px-2 py-2 text-center text-sm border-l border-gray-200">(-)</td>
            <td className="px-3 py-2 text-right text-sm border-l border-gray-200">{fmt(Math.round(leave_deduction))}</td>
          </tr>
          {row('Late Absent', String(record.late_days ?? 0), '(-)', Math.round(late_deduction))}
          {subtotalRow(sub2)}
          {row('Attendance Bonus', '', '(+)', attendance_bonus)}
          {subtotalRow(sub3)}
          {row('Conveyance', '0', '(+)', conveyance)}
          {row('Over Time', String(record.ot_days ?? 0), '(+)', Math.round(ot_addition))}
          {/* Payable */}
          <tr>
            <td colSpan={2} className="px-3 py-2.5 text-right font-bold italic text-sm">Payable Amount</td>
            <td className="px-2 py-2 border-l border-gray-200" />
            <td className="px-3 py-2.5 text-right font-bold underline text-sm border-l border-gray-200">{fmt(net_payable)}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      {record.notes && (
        <div className="mt-2 p-2 bg-yellow-50 text-yellow-800 text-xs italic border border-yellow-100 rounded">
          Note: {record.notes}
        </div>
      )}

      {/* Signature */}
      <div className="flex justify-between mt-4 px-1 text-xs text-gray-600">
        <span>Payment by</span>
        <span>Received by</span>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-200">
        <p className="font-mono text-[10px] text-gray-500">
          Salary Generated by Admin ({settings?.generated_by ?? 'Nahid'}), using {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB')}
        </p>
      </div>
    </div>
  )
}

export function SlipPreviewButton({ calc, month, year, settings }: SlipPreviewProps) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function downloadSingle() {
    setDownloading(true)
    try {
      const { downloadPDF } = await import('@/components/salary/SalarySlipPDF')
      await downloadPDF({
        calcs: [calc],
        month, year,
        generatedBy: settings?.generated_by ?? 'Nahid',
        paymentBy: settings?.payment_by ?? '',
        companyName: settings?.company_name ?? 'Bindu Premium',
      }, `${calc.employee.name}-${MONTHS[month - 1]}-${year}.pdf`)
    } catch {
      toast.error('PDF generation failed')
    }
    setDownloading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="Preview slip"
      >
        <Eye size={14} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Salary Slip — {calc.employee.name} · {MONTHS[month - 1]} {year}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[70vh] overflow-y-auto px-1">
            <SlipPreview calc={calc} month={month} year={year} settings={settings} />
          </div>
          <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Net Payable: <strong className="text-blue-700">{formatTaka(calc.net_payable)}</strong>
            </span>
            <Button onClick={downloadSingle} disabled={downloading} size="sm" className="gap-2">
              <Download size={14} />
              {downloading ? 'Generating…' : 'Download PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
