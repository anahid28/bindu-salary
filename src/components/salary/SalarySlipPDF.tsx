'use client'

import { Document, Page, View, Text, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { SalaryCalc } from '@/types'
import { MONTHS } from '@/types'
import { BINDU_LOGO } from '@/lib/logo-base64'

Font.register({
  family: 'Helvetica',
  fonts: [],
})

const GRAY_BG = '#f2f2f2'
const BORDER  = '#cccccc'
const BLACK   = '#000000'
const DARK    = '#1a1a1a'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    paddingTop: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    gap: 24,
  },

  // ── Slip container ─────────────────────────────────────
  slip: {
    flex: 1,
    flexDirection: 'column',
  },

  // ── Logo ───────────────────────────────────────────────
  logoWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 110,
    height: 34,
    objectFit: 'contain',
  },

  // ── Title ──────────────────────────────────────────────
  title: {
    textAlign: 'center',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
    color: DARK,
  },

  // ── Month box ──────────────────────────────────────────
  monthBox: {
    backgroundColor: GRAY_BG,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  monthText: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Helvetica-BoldOblique',
    color: BLACK,
  },

  // ── Employee block ─────────────────────────────────────
  empName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
    color: BLACK,
  },
  empRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  empDesig: {
    fontSize: 8.5,
    color: DARK,
  },
  empDesigBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: BLACK,
  },
  empId: {
    fontSize: 8.5,
    color: DARK,
  },
  empIdBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: BLACK,
  },

  // ── Table ──────────────────────────────────────────────
  table: {
    borderTop: `1 solid ${BORDER}`,
    borderLeft: `1 solid ${BORDER}`,
    borderRight: `1 solid ${BORDER}`,
  },

  // Header row
  tHead: {
    flexDirection: 'row',
    backgroundColor: GRAY_BG,
    borderBottom: `1 solid ${BORDER}`,
  },
  tHeadDesc: {
    flex: 1,
    padding: '4 6',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8.5,
  },
  tHeadQty: {
    width: 34,
    padding: '4 4',
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8.5,
    borderLeft: `1 solid ${BORDER}`,
  },
  tHeadOp: {
    width: 22,
    padding: '4 2',
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8.5,
    borderLeft: `1 solid ${BORDER}`,
  },
  tHeadAmt: {
    width: 52,
    padding: '4 5',
    textAlign: 'right',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8.5,
    borderLeft: `1 solid ${BORDER}`,
  },

  // Normal row
  tRow: {
    flexDirection: 'row',
    borderBottom: `1 solid ${BORDER}`,
    minHeight: 20,
  },
  tDesc: {
    flex: 1,
    padding: '3 6',
    fontSize: 8.5,
    justifyContent: 'center',
  },
  tQty: {
    width: 34,
    padding: '3 4',
    textAlign: 'center',
    fontSize: 8.5,
    borderLeft: `1 solid ${BORDER}`,
    justifyContent: 'center',
  },
  tOp: {
    width: 22,
    padding: '3 2',
    textAlign: 'center',
    fontSize: 8.5,
    borderLeft: `1 solid ${BORDER}`,
    justifyContent: 'center',
  },
  tAmt: {
    width: 52,
    padding: '3 5',
    textAlign: 'right',
    fontSize: 8.5,
    borderLeft: `1 solid ${BORDER}`,
    justifyContent: 'center',
  },

  // Subtotal row (=)
  tSubAmt: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    color: BLACK,
  },

  // Payable row
  tPayableDesc: {
    flex: 1,
    padding: '4 6',
    textAlign: 'right',
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9,
    justifyContent: 'center',
  },
  tPayableAmt: {
    width: 52,
    padding: '4 5',
    textAlign: 'right',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    borderLeft: `1 solid ${BORDER}`,
    justifyContent: 'center',
    color: BLACK,
  },

  // ── Signature ──────────────────────────────────────────
  sigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  sigText: {
    fontSize: 8.5,
    color: DARK,
  },
  noteText: {
    fontSize: 8.5,
    marginTop: 8,
    color: DARK,
    fontFamily: 'Helvetica-Oblique',
  },
})

// ── Cell helpers ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Cell({ style, children }: { style: any; children?: React.ReactNode }) {
  return <View style={style}><Text>{children ?? ''}</Text></View>
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n.toLocaleString('en-BD')
}

// ── Single slip ─────────────────────────────────────────
function Slip({ calc, month, year, generatedBy, genTimeStr }: {
  calc: SalaryCalc
  month: number
  year: number
  generatedBy: string
  genTimeStr: string
}) {
  const { employee: emp, record, basic_salary, advance_deducted,
          leave_deduction, late_deduction, ot_addition, conveyance,
          attendance_bonus, net_payable } = calc

  const monthName = `${MONTHS[month - 1]} ${year}`

  // Running subtotals
  const sub1 = basic_salary - advance_deducted                          // after advance
  const deductible_leave = Math.max(0, (record.leave_days_taken ?? 0) - emp.yearly_leave_allowance - (record.leave_adjustment ?? 0))
  const sub2 = sub1 - leave_deduction - late_deduction                  // after leave & late
  const sub3 = sub2 + attendance_bonus                                  // after attendance bonus
  // sub3 + conveyance + ot = net_payable

  const branchName = (emp.branch as unknown as { name: string })?.name ?? ''

  return (
    <View style={s.slip}>
      {/* Logo */}
      <View style={s.logoWrap}>
        <Image src={BINDU_LOGO} style={s.logo} />
      </View>

      {/* Title */}
      <Text style={s.title}>SALARY SHEET</Text>

      {/* Month box */}
      <View style={s.monthBox}>
        <Text style={s.monthText}>{monthName}</Text>
      </View>

      {/* Employee name */}
      <Text style={s.empName}>{emp.name}</Text>

      {/* Designation + ID row */}
      <View style={s.empRow}>
        <Text style={s.empDesig}>
          Designation: <Text style={s.empDesigBold}>{emp.designation}{branchName ? ` (${branchName})` : ''}</Text>
        </Text>
        <Text style={s.empId}>
          ID NO: <Text style={s.empIdBold}>{emp.employee_id}</Text>
        </Text>
      </View>

      {/* Table */}
      <View style={s.table}>
        {/* Header */}
        <View style={s.tHead}>
          <Text style={s.tHeadDesc}>Description</Text>
          <Text style={s.tHeadQty}>QTY</Text>
          <Text style={s.tHeadOp}></Text>
          <Text style={s.tHeadAmt}>Amount</Text>
        </View>

        {/* Salary */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>Salary</Cell>
          <Cell style={s.tQty}></Cell>
          <Cell style={s.tOp}></Cell>
          <View style={s.tAmt}><Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmt(basic_salary)}</Text></View>
        </View>

        {/* Advance */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>Advance Received</Cell>
          <Cell style={s.tQty}></Cell>
          <Cell style={s.tOp}>(-)</Cell>
          <Cell style={s.tAmt}>{fmt(advance_deducted)}</Cell>
        </View>

        {/* Subtotal 1 */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}></Cell>
          <Cell style={s.tQty}></Cell>
          <Cell style={s.tOp}>(=)</Cell>
          <View style={s.tAmt}><Text style={s.tSubAmt}>{fmt(sub1)}</Text></View>
        </View>

        {/* Leave */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>
            {`Leave: ${record.leave_days_taken ?? 0}, Less from yearly leave ${record.leave_adjustment ?? 0}, Used: ${calc.yearly_used_leave ?? 0}, Left ${emp.yearly_leave_allowance - (calc.yearly_used_leave ?? 0)}`}
          </Cell>
          <Cell style={s.tQty}>{deductible_leave > 0 ? String(deductible_leave) : '0'}</Cell>
          <Cell style={s.tOp}>(-)</Cell>
          <Cell style={s.tAmt}>{fmt(Math.round(leave_deduction))}</Cell>
        </View>

        {/* Late */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>Late Absent</Cell>
          <Cell style={s.tQty}>{fmt(record.late_days ?? 0)}</Cell>
          <Cell style={s.tOp}>(-)</Cell>
          <Cell style={s.tAmt}>{fmt(Math.round(late_deduction))}</Cell>
        </View>

        {/* Subtotal 2 */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}></Cell>
          <Cell style={s.tQty}></Cell>
          <Cell style={s.tOp}>(=)</Cell>
          <View style={s.tAmt}><Text style={s.tSubAmt}>{fmt(Math.round(sub2))}</Text></View>
        </View>

        {/* Attendance Bonus */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>Attendance Bonus</Cell>
          <Cell style={s.tQty}></Cell>
          <Cell style={s.tOp}>(+)</Cell>
          <Cell style={s.tAmt}>{fmt(attendance_bonus)}</Cell>
        </View>

        {/* Subtotal 3 */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}></Cell>
          <Cell style={s.tQty}></Cell>
          <Cell style={s.tOp}>(=)</Cell>
          <View style={s.tAmt}><Text style={s.tSubAmt}>{fmt(Math.round(sub3))}</Text></View>
        </View>

        {/* Conveyance */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>Conveyance</Cell>
          <Cell style={s.tQty}>0</Cell>
          <Cell style={s.tOp}>(+)</Cell>
          <Cell style={s.tAmt}>{fmt(conveyance)}</Cell>
        </View>

        {/* OT */}
        <View style={s.tRow}>
          <Cell style={s.tDesc}>Over Time</Cell>
          <Cell style={s.tQty}>{fmt(record.ot_days ?? 0)}</Cell>
          <Cell style={s.tOp}>(+)</Cell>
          <Cell style={s.tAmt}>{fmt(Math.round(ot_addition))}</Cell>
        </View>

        {/* Payable Amount */}
        <View style={s.tRow}>
          <View style={s.tPayableDesc}><Text>Payable Amount</Text></View>
          <View style={{ width: 34, borderLeft: `1 solid ${BORDER}` }} />
          <View style={{ width: 22, borderLeft: `1 solid ${BORDER}` }} />
          <View style={s.tPayableAmt}><Text>{fmt(net_payable)}</Text></View>
        </View>
      </View>

      {/* Notes */}
      {record.notes && (
        <Text style={s.noteText}>Note: {record.notes}</Text>
      )}

      {/* Signature */}
      <View style={s.sigRow}>
        <Text style={s.sigText}>Payment by</Text>
        <Text style={s.sigText}>Received by</Text>
      </View>

      <View style={{ borderTop: `1 solid ${BORDER}`, marginTop: 10, paddingTop: 5 }}>
        <Text style={{ fontFamily: 'Courier', fontSize: 7, color: '#666' }}>
          Salary Generated by Admin ({generatedBy}), using {genTimeStr}
        </Text>
      </View>
    </View>
  )
}

// ── Document ────────────────────────────────────────────
export type SalarySlipDocProps = {
  calcs: SalaryCalc[]
  month: number
  year: number
  generatedBy: string
  paymentBy: string
  companyName: string
}

export function SalarySlipDoc({ calcs, month, year, generatedBy }: SalarySlipDocProps) {
  const now = new Date()
  const genTimeStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB')
  const pages: SalaryCalc[][] = []
  for (let i = 0; i < calcs.length; i += 2) pages.push(calcs.slice(i, i + 2))

  return (
    <Document>
      {pages.map((pair, pi) => (
        <Page key={pi} size="A4" orientation="landscape" style={s.page}>
          <Slip calc={pair[0]} month={month} year={year} generatedBy={generatedBy} genTimeStr={genTimeStr} />
          {pair[1]
            ? <Slip calc={pair[1]} month={month} year={year} generatedBy={generatedBy} genTimeStr={genTimeStr} />
            : <View style={{ flex: 1 }} />
          }
        </Page>
      ))}
    </Document>
  )
}

export async function downloadPDF(props: SalarySlipDocProps, filename: string) {
  const blob = await pdf(<SalarySlipDoc {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
