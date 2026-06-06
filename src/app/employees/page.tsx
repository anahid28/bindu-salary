'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, Branch } from '@/types'
import { toast } from 'sonner'
import { Plus, Pencil, UserX, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatTaka } from '@/lib/calculations'

const EMPTY: Partial<Employee> = {
  employee_id: '', name: '', designation: '', branch_id: '',
  basic_salary: 0, yearly_leave_allowance: 1, conveyance: 1500, active: true,
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Employee>>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [filterBranch, setFilterBranch] = useState('all')

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
      yearly_leave_allowance: editing.yearly_leave_allowance ?? 1,
      conveyance: editing.conveyance ?? 1500,
      active: editing.active ?? true,
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

  const filtered = filterBranch === 'all' ? employees : employees.filter(e => e.branch_id === filterBranch)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-0.5">{employees.filter(e => e.active).length} active · {employees.length} total</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus size={16} /> Add Employee
        </Button>
      </div>

      <div className="mb-4">
        <Select value={filterBranch} onValueChange={v => setFilterBranch(v ?? 'all')}>
          <SelectTrigger className="w-56 bg-white">
            <SelectValue placeholder="Filter by branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Designation</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Basic Salary</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => (
              <tr key={emp.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{emp.employee_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                <td className="px-4 py-3 text-gray-600">{emp.designation}</td>
                <td className="px-4 py-3 text-gray-600">{(emp.branch as unknown as Branch)?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatTaka(emp.basic_salary)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={emp.active ? 'default' : 'secondary'} className="text-xs">
                    {emp.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => toggleActive(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                      {emp.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No employees found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Employee ID *</Label>
                <Input value={editing.employee_id ?? ''} onChange={e => setEditing(p => ({ ...p, employee_id: e.target.value }))} placeholder="e.g. 001" className="mt-1" />
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="Full name" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Designation *</Label>
                <Input value={editing.designation ?? ''} onChange={e => setEditing(p => ({ ...p, designation: e.target.value }))} placeholder="e.g. Manager" className="mt-1" />
              </div>
              <div>
                <Label>Branch *</Label>
                <Select value={editing.branch_id ?? ''} onValueChange={v => setEditing(p => ({ ...p, branch_id: v ?? '' }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Basic Salary (৳)</Label>
                <Input type="number" value={editing.basic_salary ?? 0} onChange={e => setEditing(p => ({ ...p, basic_salary: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Yearly Leave (days)</Label>
                <Input type="number" value={editing.yearly_leave_allowance ?? 1} onChange={e => setEditing(p => ({ ...p, yearly_leave_allowance: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Conveyance (৳)</Label>
                <Input type="number" value={editing.conveyance ?? 1500} onChange={e => setEditing(p => ({ ...p, conveyance: +e.target.value }))} className="mt-1" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
