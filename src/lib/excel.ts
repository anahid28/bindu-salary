import * as XLSX from 'xlsx'
import type { Employee, Branch, SalaryRecord } from '@/types'
import { MONTHS } from '@/types'

// ─── Employee Import ────────────────────────────────────────────────────────

const EMPLOYEE_HEADERS = [
  'Employee ID',
  'Name',
  'Branch',
  'Designation',
  'Basic Salary',
  'Conveyance',
  'Yearly Leave',
] as const

export type EmployeeSheetRow = {
  employee_id: string
  name: string
  branch: string
  designation: string
  basic_salary: number
  conveyance: number
  yearly_leave_allowance: number
}

/**
 * Download an employee template Excel file.
 * If employees exist, pre-fill with current data. Otherwise provide blank template.
 */
export function downloadEmployeeTemplate(employees?: Employee[], branches?: Branch[]) {
  const branchMap = new Map((branches ?? []).map(b => [b.id, b.name]))
  const data = (employees ?? []).map(emp => ({
    'Employee ID': emp.employee_id,
    'Name': emp.name,
    'Branch': branchMap.get(emp.branch_id) ?? '',
    'Designation': emp.designation,
    'Basic Salary': emp.basic_salary,
    'Conveyance': emp.conveyance,
    'Yearly Leave': emp.yearly_leave_allowance,
  }))

  // If no employees, create a sample row so user sees the format
  if (data.length === 0) {
    data.push({
      'Employee ID': '001',
      'Name': 'Sample Employee',
      'Branch': 'Cox Branch',
      'Designation': 'Manager',
      'Basic Salary': 15000,
      'Conveyance': 1500,
      'Yearly Leave': 12,
    })
  }

  const ws = XLSX.utils.json_to_sheet(data, { header: [...EMPLOYEE_HEADERS] })
  ws['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, 'Bindu_Employees.xlsx')
}

/**
 * Parse an uploaded employee Excel/CSV file.
 * Flexible header matching — supports many variants.
 */
export function parseEmployeeSheet(
  file: File,
): Promise<{ rows: EmployeeSheetRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const rows: EmployeeSheetRow[] = []
      const errors: string[] = []

      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          resolve({ rows: [], errors: ['No sheets found. Make sure it is a valid .xlsx, .xls, or .csv file.'] })
          return
        }

        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) {
          resolve({ rows: [], errors: ['Sheet data is empty or unreadable.'] })
          return
        }

        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

        if (!json || json.length === 0) {
          resolve({ rows: [], errors: ['The sheet appears to be empty. Make sure data starts from row 1 with headers.'] })
          return
        }

        const firstRowKeys = Object.keys(json[0])
        console.log('[parseEmployeeSheet] Detected headers:', firstRowKeys)

        json.forEach((row, idx) => {
          // Normalize keys: trim + lowercase
          const n: Record<string, unknown> = {}
          for (const key of Object.keys(row)) {
            n[key.trim().toLowerCase()] = row[key]
          }

          const empId = String(
            n['employee id'] ?? n['employee_id'] ?? n['id'] ??
            n['emp id'] ?? n['emp_id'] ?? n['staff id'] ?? ''
          ).trim()
          const name = String(
            n['name'] ?? n['employee name'] ?? n['full name'] ?? n['staff name'] ?? ''
          ).trim()

          if (!empId && !name) return // skip blank rows

          rows.push({
            employee_id: empId,
            name,
            branch: String(
              n['branch'] ?? n['branch name'] ?? n['location'] ?? n['office'] ?? ''
            ).trim(),
            designation: String(
              n['designation'] ?? n['role'] ?? n['position'] ?? n['title'] ?? n['job title'] ?? ''
            ).trim(),
            basic_salary: Number(
              n['basic salary'] ?? n['basic_salary'] ?? n['basic'] ?? n['salary'] ?? 0
            ) || 0,
            conveyance: Number(
              n['conveyance'] ?? n['conveyance (৳)'] ?? n['conv'] ?? n['transport'] ?? 0
            ) || 0,
            yearly_leave_allowance: Number(
              n['yearly leave'] ?? n['yearly_leave'] ?? n['leave'] ??
              n['leave allowance'] ?? n['annual leave'] ?? 0
            ) || 0,
          })
        })

        if (rows.length === 0) {
          errors.push(`No valid rows found. Detected headers: ${firstRowKeys.join(', ')}. Make sure Employee ID or Name columns exist.`)
        }
      } catch (err) {
        errors.push(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      resolve({ rows, errors })
    }
    reader.readAsArrayBuffer(file)
  })
}

const HEADERS = [
  'Employee ID',
  'Name',
  'Branch',
  'Basic Salary',
  'Advance (৳)',
  'Leave (days)',
  'Leave Adjustment (±days)',
  'Late (days)',
  'OT (days)',
  'Conveyance (৳)',
  'Attendance Bonus (৳)',
  'Notes',
] as const

export type SheetRow = {
  employee_id: string
  name: string
  branch: string
  basic_salary: number
  advance_deducted: number
  leave_days_taken: number
  leave_adjustment: number
  late_days: number
  ot_days: number
  conveyance: number
  attendance_bonus: number
  notes: string
}

/**
 * Generate & download a pre-filled Excel template for the given month/year.
 * Employee names, branches, and basic salary are pre-filled and locked (read-only context).
 * Admin fills in: Advance, Leave, Late, OT, Conveyance, Attendance Bonus.
 */
export function downloadTemplate(
  employees: Employee[],
  month: number,
  year: number,
  existingRecords?: SalaryRecord[],
) {
  const recMap = new Map((existingRecords ?? []).map(r => [r.employee_id, r]))

  const data = employees.map(emp => {
    const rec = recMap.get(emp.id)
    const branchName = (emp.branch as unknown as Branch)?.name ?? ''
    return {
      'Employee ID': emp.employee_id,
      'Name': emp.name,
      'Branch': branchName,
      'Basic Salary': emp.basic_salary,
      'Advance (৳)': rec?.advance_deducted ?? 0,
      'Leave (days)': rec?.leave_days_taken ?? 0,
      'Leave Adjustment (±days)': rec?.leave_adjustment ?? 0,
      'Late (days)': rec?.late_days ?? 0,
      'OT (days)': rec?.ot_days ?? 0,
      'Conveyance (৳)': rec?.conveyance ?? emp.conveyance,
      'Attendance Bonus (৳)': rec?.attendance_bonus ?? 0,
      'Notes': rec?.notes ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(data, { header: [...HEADERS] })

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Name
    { wch: 22 }, // Branch
    { wch: 14 }, // Basic Salary
    { wch: 14 }, // Advance
    { wch: 14 }, // Leave
    { wch: 20 }, // Leave Adjustment
    { wch: 12 }, // Late
    { wch: 12 }, // OT
    { wch: 16 }, // Conveyance
    { wch: 20 }, // Attendance Bonus
    { wch: 30 }, // Notes
  ]

  const wb = XLSX.utils.book_new()
  const sheetName = `${MONTHS[month - 1]} ${year}`
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  XLSX.writeFile(wb, `Bindu_Salary_${MONTHS[month - 1]}_${year}.xlsx`)
}

/**
 * Parse an uploaded Excel file and return rows mapped by employee_id.
 * Matches by Employee ID column or falls back to name matching.
 */
export function parseSalarySheet(
  file: File,
): Promise<{ rows: SheetRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const rows: SheetRow[] = []
      const errors: string[] = []

      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          resolve({ rows: [], errors: ['No sheets found in the uploaded file. Make sure it is a valid .xlsx, .xls, or .csv file.'] })
          return
        }

        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) {
          resolve({ rows: [], errors: ['Sheet data is empty or unreadable.'] })
          return
        }

        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

        if (!json || json.length === 0) {
          resolve({ rows: [], errors: ['The sheet appears to be empty. Make sure data starts from row 1 with headers.'] })
          return
        }

        // Debug: log the actual keys from the first row so users can see what headers were detected
        const firstRowKeys = Object.keys(json[0])
        console.log('[parseSalarySheet] Detected headers:', firstRowKeys)

        json.forEach((row, idx) => {
          const lineNum = idx + 2 // +2 because row 1 is headers

          // Flexible header matching: trim and lowercase all keys for comparison
          const normalizedRow: Record<string, unknown> = {}
          for (const key of Object.keys(row)) {
            normalizedRow[key.trim().toLowerCase()] = row[key]
          }

          const empId = String(
            normalizedRow['employee id'] ??
            normalizedRow['employee_id'] ??
            normalizedRow['id'] ??
            normalizedRow['emp id'] ??
            normalizedRow['emp_id'] ?? ''
          ).trim()
          const name = String(
            normalizedRow['name'] ??
            normalizedRow['employee name'] ??
            normalizedRow['full name'] ?? ''
          ).trim()

          if (!empId && !name) {
            return // skip blank rows
          }

          rows.push({
            employee_id: empId,
            name,
            branch: String(normalizedRow['branch'] ?? normalizedRow['branch name'] ?? '').trim(),
            basic_salary: Number(normalizedRow['basic salary'] ?? normalizedRow['basic_salary'] ?? normalizedRow['basic'] ?? 0) || 0,
            advance_deducted: Number(normalizedRow['advance (৳)'] ?? normalizedRow['advance'] ?? normalizedRow['advance deducted'] ?? normalizedRow['total advance'] ?? 0) || 0,
            leave_days_taken: Number(normalizedRow['leave (days)'] ?? normalizedRow['leave'] ?? normalizedRow['leave days'] ?? normalizedRow['total leave'] ?? 0) || 0,
            leave_adjustment: Number(normalizedRow['leave adjustment (±days)'] ?? normalizedRow['leave adjustment'] ?? normalizedRow['leave adj'] ?? 0) || 0,
            late_days: Number(normalizedRow['late (days)'] ?? normalizedRow['late'] ?? normalizedRow['late days'] ?? normalizedRow['total late'] ?? 0) || 0,
            ot_days: Number(normalizedRow['ot (days)'] ?? normalizedRow['ot'] ?? normalizedRow['ot days'] ?? normalizedRow['total ot'] ?? 0) || 0,
            conveyance: Number(normalizedRow['conveyance (৳)'] ?? normalizedRow['conveyance'] ?? normalizedRow['conv'] ?? 0) || 0,
            attendance_bonus: Number(normalizedRow['attendance bonus (৳)'] ?? normalizedRow['attendance bonus'] ?? normalizedRow['att bonus'] ?? 0) || 0,
            notes: String(normalizedRow['notes'] ?? normalizedRow['note'] ?? normalizedRow['remarks'] ?? '').trim(),
          })
        })

        if (rows.length === 0) {
          errors.push(`No valid rows found. Detected headers: ${firstRowKeys.join(', ')}. Make sure Employee ID or Name columns exist.`)
        }
      } catch (err) {
        errors.push(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      resolve({ rows, errors })
    }
    reader.readAsArrayBuffer(file)
  })
}
