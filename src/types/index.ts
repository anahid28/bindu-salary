export type Branch = {
  id: string
  name: string
  created_at: string
}

export type Employee = {
  id: string
  employee_id: string
  name: string
  designation: string
  branch_id: string
  branch?: Branch
  basic_salary: number
  yearly_leave_allowance: number
  conveyance: number
  active: boolean
  created_at: string
}

export type SalaryRecord = {
  id: string
  employee_id: string
  employee?: Employee
  month: number
  year: number
  advance_deducted: number
  leave_days_taken: number
  leave_adjustment: number
  late_days: number
  ot_days: number
  attendance_bonus: number
  conveyance?: number
  notes: string
  created_at: string
}

export type EidRecord = {
  id: string
  employee_id: string
  employee?: Employee
  title: string
  year: number
  salary_payment_pct: number
  advance_deducted: number
  eid_bonus_pct: number
  created_at: string
}

export type Settings = {
  id: string
  company_name: string
  logo_url: string | null
  generated_by: string
  payment_by: string
  updated_at: string
}

export type SalaryCalc = {
  employee: Employee
  record: SalaryRecord
  basic_salary: number
  advance_deducted: number
  leave_deduction: number
  late_deduction: number
  ot_addition: number
  conveyance: number
  attendance_bonus: number
  net_payable: number
  daily_rate: number
}

export type EidCalc = {
  employee: Employee
  record: EidRecord
  basic_salary: number
  salary_payment: number
  advance_deducted: number
  eid_bonus: number
  net_payable: number
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
