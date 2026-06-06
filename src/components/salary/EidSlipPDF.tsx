'use client'

import { Document, Page, View, Text, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { EidCalc } from '@/types'
import { BINDU_LOGO } from '@/lib/logo-base64'

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
  slip: { flex: 1, flexDirection: 'column' },
  logoWrap: { alignItems: 'center', marginBottom: 4 },
  logo: { width: 110, height: 34, objectFit: 'contain' },
  title: { textAlign: 'center', fontSize: 9, letterSpacing: 1, marginBottom: 4, color: DARK },
  monthBox: { backgroundColor: GRAY_BG, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 10 },
  monthText: { textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-BoldOblique', color: BLACK },
  empName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3, color: BLACK },
  empRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  empDesig: { fontSize: 8.5, color: DARK },
  empDesigBold: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: BLACK },
  empId: { fontSize: 8.5, color: DARK },
  empIdBold: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: BLACK },
  table: { borderTop: `1 solid ${BORDER}`, borderLeft: `1 solid ${BORDER}`, borderRight: `1 solid ${BORDER}` },
  tHead: { flexDirection: 'row', backgroundColor: GRAY_BG, borderBottom: `1 solid ${BORDER}` },
  tHeadDesc: { flex: 1, padding: '4 6', fontFamily: 'Helvetica-Oblique', fontSize: 8.5 },
  tHeadQty: { width: 34, padding: '4 4', textAlign: 'center', fontFamily: 'Helvetica-Oblique', fontSize: 8.5, borderLeft: `1 solid ${BORDER}` },
  tHeadOp: { width: 22, padding: '4 2', textAlign: 'center', fontFamily: 'Helvetica-Oblique', fontSize: 8.5, borderLeft: `1 solid ${BORDER}` },
  tHeadAmt: { width: 52, padding: '4 5', textAlign: 'right', fontFamily: 'Helvetica-Oblique', fontSize: 8.5, borderLeft: `1 solid ${BORDER}` },
  tRow: { flexDirection: 'row', borderBottom: `1 solid ${BORDER}`, minHeight: 20 },
  tDesc: { flex: 1, padding: '3 6', fontSize: 8.5, justifyContent: 'center' },
  tQty: { width: 34, padding: '3 4', textAlign: 'center', fontSize: 8.5, borderLeft: `1 solid ${BORDER}`, justifyContent: 'center' },
  tOp: { width: 22, padding: '3 2', textAlign: 'center', fontSize: 8.5, borderLeft: `1 solid ${BORDER}`, justifyContent: 'center' },
  tAmt: { width: 52, padding: '3 5', textAlign: 'right', fontSize: 8.5, borderLeft: `1 solid ${BORDER}`, justifyContent: 'center' },
  tSubAmt: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', color: BLACK },
  tPayableDesc: { flex: 1, padding: '4 6', textAlign: 'right', fontFamily: 'Helvetica-BoldOblique', fontSize: 9, justifyContent: 'center' },
  tPayableAmt: { width: 52, padding: '4 5', textAlign: 'right', fontSize: 9, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', borderLeft: `1 solid ${BORDER}`, justifyContent: 'center', color: BLACK },
  noteBox: { backgroundColor: '#fffbeb', borderTop: `1 solid #fde68a`, padding: '4 6', marginTop: 0 },
  noteText: { fontSize: 7, color: '#92400e', fontFamily: 'Helvetica-Oblique' },
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 },
  sigText: { fontSize: 8.5, color: DARK },
})

function fmt(n: number) {
  return n === 0 ? '0' : n.toLocaleString('en-BD')
}

function EidSlip({ calc, title, generatedBy }: { calc: EidCalc; title: string; generatedBy: string }) {
  const { employee: emp, record, basic_salary, salary_payment, advance_deducted, eid_bonus, net_payable } = calc
  const branchName = (emp.branch as unknown as { name: string })?.name ?? ''
  const sub1 = salary_payment - advance_deducted

  return (
    <View style={s.slip}>
      <View style={s.logoWrap}>
        <Image src={BINDU_LOGO} style={s.logo} />
      </View>
      <Text style={s.title}>SALARY SHEET</Text>
      <View style={s.monthBox}>
        <Text style={s.monthText}>{title}</Text>
      </View>
      <Text style={s.empName}>{emp.name}</Text>
      <View style={s.empRow}>
        <Text style={s.empDesig}>
          Designation: <Text style={s.empDesigBold}>{emp.designation}{branchName ? ` (${branchName})` : ''}</Text>
        </Text>
        <Text style={s.empId}>ID NO: <Text style={s.empIdBold}>{emp.employee_id}</Text></Text>
      </View>

      <View style={s.table}>
        <View style={s.tHead}>
          <Text style={s.tHeadDesc}>Description</Text>
          <Text style={s.tHeadQty}>QTY</Text>
          <Text style={s.tHeadOp}></Text>
          <Text style={s.tHeadAmt}>Amount</Text>
        </View>

        {/* Total Salary */}
        <View style={s.tRow}>
          <View style={s.tDesc}><Text>Total Salary</Text></View>
          <View style={s.tQty}><Text></Text></View>
          <View style={s.tOp}><Text></Text></View>
          <View style={s.tAmt}><Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmt(basic_salary)}</Text></View>
        </View>

        {/* Salary Payment */}
        <View style={s.tRow}>
          <View style={s.tDesc}><Text>Salary Payment ({record.salary_payment_pct}%)</Text></View>
          <View style={s.tQty}><Text></Text></View>
          <View style={s.tOp}><Text>(-)</Text></View>
          <View style={s.tAmt}><Text>{fmt(salary_payment)}</Text></View>
        </View>

        {/* Advance */}
        <View style={s.tRow}>
          <View style={s.tDesc}><Text>Advance Received</Text></View>
          <View style={s.tQty}><Text></Text></View>
          <View style={s.tOp}><Text>(-)</Text></View>
          <View style={s.tAmt}><Text>{fmt(advance_deducted)}</Text></View>
        </View>

        {/* Subtotal */}
        <View style={s.tRow}>
          <View style={s.tDesc}><Text></Text></View>
          <View style={s.tQty}><Text></Text></View>
          <View style={s.tOp}><Text>(=)</Text></View>
          <View style={s.tAmt}><Text style={s.tSubAmt}>{fmt(sub1)}</Text></View>
        </View>

        {/* Eid Bonus */}
        <View style={s.tRow}>
          <View style={s.tDesc}><Text>Eid Bonus ({record.eid_bonus_pct}%)</Text></View>
          <View style={s.tQty}><Text></Text></View>
          <View style={s.tOp}><Text>(+)</Text></View>
          <View style={s.tAmt}><Text>{fmt(eid_bonus)}</Text></View>
        </View>

        {/* Payable */}
        <View style={s.tRow}>
          <View style={s.tPayableDesc}><Text>Payable Amount</Text></View>
          <View style={{ width: 34, borderLeft: `1 solid ${BORDER}` }} />
          <View style={{ width: 22, borderLeft: `1 solid ${BORDER}` }} />
          <View style={s.tPayableAmt}><Text>{fmt(net_payable)}</Text></View>
        </View>
      </View>

      {/* Note */}
      <View style={s.noteBox}>
        <Text style={s.noteText}>Note: Conveyance, Leave, Late, Attendance Bonus & OT adjusted at final due payment.</Text>
      </View>

      <View style={s.sigRow}>
        <Text style={s.sigText}>Salary generated by: {generatedBy}</Text>
        <Text style={s.sigText}>Received by</Text>
      </View>
    </View>
  )
}

export type EidDocProps = {
  calcs: EidCalc[]
  title: string
  generatedBy: string
  paymentBy: string
  companyName: string
}

export function EidSlipDoc({ calcs, title, generatedBy }: EidDocProps) {
  const pages: EidCalc[][] = []
  for (let i = 0; i < calcs.length; i += 2) pages.push(calcs.slice(i, i + 2))
  return (
    <Document>
      {pages.map((pair, pi) => (
        <Page key={pi} size="A4" orientation="landscape" style={s.page}>
          <EidSlip calc={pair[0]} title={title} generatedBy={generatedBy} />
          {pair[1]
            ? <EidSlip calc={pair[1]} title={title} generatedBy={generatedBy} />
            : <View style={{ flex: 1 }} />
          }
        </Page>
      ))}
    </Document>
  )
}

export async function downloadEidPDF(props: EidDocProps, filename: string) {
  const blob = await pdf(<EidSlipDoc {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
