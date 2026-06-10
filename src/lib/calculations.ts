import type { Employee, SalaryRecord, EidRecord, SalaryCalc, EidCalc } from '@/types'

const WORKING_DAYS = 26

export function calcSalary(employee: Employee, record: SalaryRecord, yearly_used_leave: number = 0): SalaryCalc {
  const daily_rate = employee.basic_salary / WORKING_DAYS

  // Leave deduction: deduct days taken minus any leave adjustment
  const deductable_leave = Math.max(0, record.leave_days_taken - (record.leave_adjustment ?? 0))
  const leave_deduction = deductable_leave * daily_rate

  // Late deduction: every 3 late days = 1 day salary
  const late_deduction = Math.floor(record.late_days / 3) * daily_rate

  // OT: 1 day = 1 day salary
  const ot_addition = record.ot_days * daily_rate

  // Use monthly conveyance override if set, else employee default
  const conveyance = record.conveyance ?? employee.conveyance

  const net_payable =
    employee.basic_salary
    - record.advance_deducted
    - leave_deduction
    - late_deduction
    + ot_addition
    + conveyance
    + record.attendance_bonus

  return {
    employee,
    record,
    basic_salary: employee.basic_salary,
    advance_deducted: record.advance_deducted,
    leave_deduction,
    late_deduction,
    ot_addition,
    conveyance,
    attendance_bonus: record.attendance_bonus,
    net_payable: Math.round(net_payable / 10) * 10,
    daily_rate,
    yearly_used_leave,
  }
}

export function calcEid(employee: Employee, record: EidRecord): EidCalc {
  const salary_payment = Math.round(employee.basic_salary * record.salary_payment_pct / 100)
  const eid_bonus = Math.round(employee.basic_salary * record.eid_bonus_pct / 100)
  const net_payable = salary_payment - record.advance_deducted + eid_bonus

  return {
    employee,
    record,
    basic_salary: employee.basic_salary,
    salary_payment,
    advance_deducted: record.advance_deducted,
    eid_bonus,
    net_payable: Math.round(net_payable / 10) * 10,
  }
}

export function formatTaka(amount: number) {
  return `৳ ${amount.toLocaleString('en-BD')}`
}
