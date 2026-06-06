'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch } from '@/types'
import { toast } from 'sonner'
import { Plus, Pencil, UserX, UserCheck, Users, Download, Upload, CheckCircle2, RefreshCw, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SearchFilter, type SortOption } from '@/components/shared/SearchFilter'
import { downloadCSV } from '@/lib/csv'
import { formatTaka } from '@/lib/calculations'
import { downloadEmployeeTemplate, parseEmployeeSheet } from '@/lib/excel'
import { EmployeeProfileModal } from '@/components/employees/EmployeeProfileModal'

const EMPTY: Partial<Employee> = {
  employee_id: '', name: '', designation: '', branch_id: '',
  basic_salary: 0, yearly_leave_allowance: 12, conveyance: 1500, active: true,
  mobile_number: '', date_of_birth: '', joining_date: '', address: '',
  emergency_contact: '', blood_group: '', nid_number: '',
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
]

function avatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name A–Z', value: 'name_asc' },
  { label: 'Name Z–A', value: 'name_desc' },
  { label: 'Salary High–Low', value: 'salary_desc' },
  { label: 'Salary Low–High', value: 'salary_asc' },
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
]

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Employee>>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortValue, setSortValue] = useState('name_asc')
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; fileName: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const { data } = await supabase
      .from('employees')
      .select('*, branch:branches(*)')
      .order('name')
    setEmployees((data as Employee[]) ?? [])
  }

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('*').order('name')
    setBranches(data ?? [])
  }

  useEffect(() => { load(); loadBranches() }, [])

  function openNew() { setEditing({ ...EMPTY }); setOpen(true) }
  function openEdit(emp: Employee) { setEditing({ ...emp }); setOpen(true) }

  async function save() {
    if (!editing.name || !editing.designation || !editing.branch_id || !editing.employee_id) {
      toast.error('Please fill all required fields')
      return
    }
    setLoading(true)
    const payload = {
      employee_id: editing.employee_id,
      name: editing.name,
      designation: editing.designation,
      branch_id: editing.branch_id,
      basic_salary: editing.basic_salary ?? 0,
      yearly_leave_allowance: editing.yearly_leave_allowance ?? 12,
      conveyance: editing.conveyance ?? 1500,
      active: editing.active ?? true,
      mobile_number: editing.mobile_number || null,
      date_of_birth: editing.date_of_birth || null,
      joining_date: editing.joining_date || null,
      address: editing.address || null,
      emergency_contact: editing.emergency_contact || null,
      blood_group: editing.blood_group || null,
      nid_number: editing.nid_number || null,
    }
    if (editing.id) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Employee updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('employees').insert(payload)
      if (error) toast.error(error.message)
      else { toast.success('Employee added'); setOpen(false); load() }
    }
    setLoading(false)
  }

  async function toggleActive(emp: Employee) {
    const { error } = await supabase.from('employees').update({ active: !emp.active }).eq('id', emp.id)
    if (error) toast.error(error.message)
    else { toast.success(emp.active ? 'Employee deactivated' : 'Employee reactivated'); load() }
  }

  // Counts for status tabs
  const activeCount = employees.filter(e => e.active).length
  const inactiveCount = employees.filter(e => !e.active).length

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...employees]

    // Status filter
    if (statusFilter === 'active') list = list.filter(e => e.active)
    else if (statusFilter === 'inactive') list = list.filter(e => !e.active)

    // Branch filter
    if (filterBranch !== 'all') list = list.filter(e => e.branch_id === filterBranch)

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q)
      )
    }

    // Sort
    switch (sortValue) {
      case 'name_asc': list.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'name_desc': list.sort((a, b) => b.name.localeCompare(a.name)); break
      case 'salary_desc': list.sort((a, b) => b.basic_salary - a.basic_salary); break
      case 'salary_asc': list.sort((a, b) => a.basic_salary - b.basic_salary); break
      case 'newest': list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break
      case 'oldest': list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break
    }

    return list
  }, [employees, statusFilter, filterBranch, search, sortValue])

  // --- Employee Sheet Upload / Sync ---
  function handleDownloadTemplate() {
    downloadEmployeeTemplate(employees, branches)
    toast.success('Employee template downloaded — edit and upload back')
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImportResult(null)

    const { rows, errors } = await parseEmployeeSheet(file)
    if (errors.length > 0) errors.forEach(err => toast.error(err))
    if (rows.length === 0) {
      toast.error('No valid employee data found in the file')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Step 1: Ensure all branches from sheet exist in DB (auto-create missing ones)
    const sheetBranchNames = [...new Set(rows.map(r => r.branch).filter(Boolean))]
    let { data: allBranches } = await supabase.from('branches').select('*')
    allBranches = allBranches ?? []

    const existingBranchMap = new Map(allBranches.map(b => [b.name.toLowerCase(), b.id]))
    const newBranchNames = sheetBranchNames.filter(name => !existingBranchMap.has(name.toLowerCase()))

    if (newBranchNames.length > 0) {
      const { data: created, error } = await supabase
        .from('branches')
        .insert(newBranchNames.map(name => ({ name })))
        .select('*')
      if (error) {
        toast.error(`Failed to create branches: ${error.message}`)
      } else {
        for (const b of (created ?? [])) {
          existingBranchMap.set(b.name.toLowerCase(), b.id)
        }
        toast.success(`Created ${created?.length ?? 0} new branch(es): ${newBranchNames.join(', ')}`)
      }
    }

    // Re-fetch branches for the UI
    const { data: refreshedBranches } = await supabase.from('branches').select('*').order('name')
    if (refreshedBranches) setBranches(refreshedBranches as Branch[])

    // Step 2: Fetch existing employees to determine add vs update
    const { data: existingEmps } = await supabase.from('employees').select('id, employee_id')
    const existingIdMap = new Map((existingEmps ?? []).map(e => [e.employee_id, e.id]))

    let added = 0, updated = 0, skipped = 0

    // Step 3: Process each row
    for (const row of rows) {
      if (!row.employee_id && !row.name) { skipped++; continue }

      const branchId = row.branch
        ? existingBranchMap.get(row.branch.toLowerCase()) ?? null
        : null

      const payload = {
        employee_id: row.employee_id || `AUTO-${Date.now()}`,
        name: row.name || 'Unknown',
        designation: row.designation || 'Staff',
        branch_id: branchId,
        basic_salary: row.basic_salary || 0,
        conveyance: row.conveyance || 1500,
        yearly_leave_allowance: row.yearly_leave_allowance || 12,
        active: true,
      }

      const existingUuid = existingIdMap.get(row.employee_id)
      if (existingUuid) {
        // Update existing employee
        const { error } = await supabase.from('employees').update(payload).eq('id', existingUuid)
        if (error) { skipped++; console.error('Update error:', error.message) }
        else updated++
      } else {
        // Insert new employee
        const { error } = await supabase.from('employees').insert(payload)
        if (error) {
          // Might be duplicate on employee_id unique constraint — try upsert
          if (error.code === '23505') {
            const { error: upErr } = await supabase
              .from('employees')
              .upsert(payload, { onConflict: 'employee_id' })
            if (upErr) { skipped++; console.error('Upsert error:', upErr.message) }
            else updated++
          } else {
            skipped++; console.error('Insert error:', error.message)
          }
        } else {
          added++
        }
      }
    }

    setImportResult({ added, updated, skipped, fileName: file.name })
    toast.success(`Synced: ${added} added, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ''}`)
    await load()
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function exportCSV() {
    const headers = ['Employee ID', 'Name', 'Designation', 'Branch', 'Basic Salary', 'Status', 'Conveyance', 'Yearly Leave']
    const rows = filtered.map(e => [
      e.employee_id,
      e.name,
      e.designation,
      (e.branch as unknown as Branch)?.name ?? '',
      e.basic_salary,
      e.active ? 'Active' : 'Inactive',
      e.conveyance,
      e.yearly_leave_allowance,
    ])
    downloadCSV(headers, rows, `Employees_${new Date().toISOString().slice(0, 10)}`)
    toast.success(`Exported ${filtered.length} employees to CSV`)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-0.5">{activeCount} active · {inactiveCount} inactive · {employees.length} total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
            <Download size={14} />Template
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs">
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Syncing…' : 'Upload Sheet'}
          </Button>
          <Button onClick={openNew} className="gap-2 flex-1 sm:flex-none">
            <Plus size={16} /> Add Employee
          </Button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-sm">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-emerald-800 font-medium">
              {importResult.added} added · {importResult.updated} updated
              {importResult.skipped > 0 && <span className="text-emerald-600"> · {importResult.skipped} skipped</span>}
            </span>
            <span className="text-emerald-600 ml-2 hidden sm:inline">from {importResult.fileName}</span>
          </div>
          <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600 text-xs">✕</button>
        </div>
      )}

      <SearchFilter
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, ID, or role..."
        branches={branches}
        branchFilter={filterBranch}
        onBranchChange={setFilterBranch}
        showBranchFilter
        statusOptions={[
          { label: 'All', value: 'all', count: employees.length },
          { label: 'Active', value: 'active', count: activeCount },
          { label: 'Inactive', value: 'inactive', count: inactiveCount },
        ]}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortOptions={SORT_OPTIONS}
        sortValue={sortValue}
        onSortChange={setSortValue}
        resultCount={filtered.length}
        resultLabel="employees"
        onExportCSV={exportCSV}
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Designation</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Basic Salary</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(emp.id)}`}>
                      {getInitials(emp.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{emp.employee_id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{emp.designation}</td>
                <td className="px-4 py-3 text-gray-600">{(emp.branch as unknown as Branch)?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatTaka(emp.basic_salary)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={emp.active ? 'default' : 'secondary'} className={`text-xs ${emp.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}`}>
                    {emp.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewingEmployee(emp)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors" title="View profile">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => toggleActive(emp)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title={emp.active ? 'Deactivate' : 'Activate'}>
                      {emp.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Users size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No employees found</p>
                  <p className="text-gray-300 text-xs mt-1">Try changing filters or add a new employee</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing.id ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personal Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Employee ID *</Label>
                  <Input value={editing.employee_id ?? ''} onChange={e => setEditing(p => ({ ...p, employee_id: e.target.value }))} placeholder="e.g. 001" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Full Name *</Label>
                  <Input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="Full name" className="mt-1" />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Role & Branch</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Designation *</Label>
                  <Input value={editing.designation ?? ''} onChange={e => setEditing(p => ({ ...p, designation: e.target.value }))} placeholder="e.g. Manager" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Branch *</Label>
                  <Select value={editing.branch_id ?? ''} onValueChange={v => setEditing(p => ({ ...p, branch_id: v ?? '' }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Compensation</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Basic Salary (৳)</Label>
                  <Input type="number" value={editing.basic_salary ?? 0} onChange={e => setEditing(p => ({ ...p, basic_salary: +e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Yearly Leave</Label>
                  <Input type="number" value={editing.yearly_leave_allowance ?? 12} onChange={e => setEditing(p => ({ ...p, yearly_leave_allowance: +e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Conveyance (৳)</Label>
                  <Input type="number" value={editing.conveyance ?? 1500} onChange={e => setEditing(p => ({ ...p, conveyance: +e.target.value }))} className="mt-1" />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Additional Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Mobile Number</Label>
                  <Input value={editing.mobile_number ?? ''} onChange={e => setEditing(p => ({ ...p, mobile_number: e.target.value }))} placeholder="e.g. 01711-000000" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Blood Group</Label>
                  <Input value={editing.blood_group ?? ''} onChange={e => setEditing(p => ({ ...p, blood_group: e.target.value }))} placeholder="e.g. B+" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                  <Input value={editing.date_of_birth ?? ''} onChange={e => setEditing(p => ({ ...p, date_of_birth: e.target.value }))} placeholder="e.g. 01/01/1990" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Joining Date</Label>
                  <Input value={editing.joining_date ?? ''} onChange={e => setEditing(p => ({ ...p, joining_date: e.target.value }))} placeholder="e.g. 01/01/2022" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">NID Number</Label>
                  <Input value={editing.nid_number ?? ''} onChange={e => setEditing(p => ({ ...p, nid_number: e.target.value }))} placeholder="National ID" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Emergency Contact</Label>
                  <Input value={editing.emergency_contact ?? ''} onChange={e => setEditing(p => ({ ...p, emergency_contact: e.target.value }))} placeholder="Family contact number" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-gray-700">Address</Label>
                  <Input value={editing.address ?? ''} onChange={e => setEditing(p => ({ ...p, address: e.target.value }))} placeholder="Full address" className="mt-1" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-gray-100">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={loading} className="min-w-[100px]">{loading ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeProfileModal
        employee={viewingEmployee}
        open={!!viewingEmployee}
        onOpenChange={open => { if (!open) setViewingEmployee(null) }}
        onEdit={() => viewingEmployee && openEdit(viewingEmployee)}
      />
    </div>
  )
}
