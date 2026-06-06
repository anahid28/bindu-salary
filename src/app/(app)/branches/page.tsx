'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Branch, Employee } from '@/types'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Building2, Users, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatTaka } from '@/lib/calculations'

type BranchWithStats = Branch & { employeeCount: number; totalBasic: number }

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [open, setOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null)
  const [editing, setEditing] = useState<Partial<Branch>>({})
  const [loading, setLoading] = useState(false)
  const [sortAsc, setSortAsc] = useState(true)

  async function load() {
    const [{ data: brs }, { data: emps }] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('employees').select('id, branch_id, basic_salary, active').eq('active', true),
    ])
    setBranches(brs ?? [])
    setEmployees((emps as Employee[]) ?? [])
  }

  useEffect(() => { load() }, [])

  // Stats per branch
  const branchStats: BranchWithStats[] = useMemo(() => {
    return branches.map(b => {
      const branchEmps = employees.filter(e => e.branch_id === b.id)
      return {
        ...b,
        employeeCount: branchEmps.length,
        totalBasic: branchEmps.reduce((s, e) => s + e.basic_salary, 0),
      }
    }).sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
  }, [branches, employees, sortAsc])

  const totalEmployees = employees.length

  async function save() {
    if (!editing.name?.trim()) { toast.error('Branch name required'); return }
    setLoading(true)
    if (editing.id) {
      const { error } = await supabase.from('branches').update({ name: editing.name }).eq('id', editing.id)
      if (error) toast.error(error.message)
      else { toast.success('Branch updated'); setOpen(false); load() }
    } else {
      const { error } = await supabase.from('branches').insert({ name: editing.name })
      if (error) toast.error(error.message)
      else { toast.success('Branch added'); setOpen(false); load() }
    }
    setLoading(false)
  }

  async function deleteBranch() {
    if (!deleteConfirm) return
    const { error } = await supabase.from('branches').delete().eq('id', deleteConfirm.id)
    if (error) toast.error(error.message)
    else { toast.success('Branch deleted'); setDeleteConfirm(null); load() }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-500 text-sm mt-0.5">{branches.length} branches · {totalEmployees} active employees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSortAsc(!sortAsc)} className="gap-1.5 text-xs">
            <ArrowUpDown size={13} />{sortAsc ? 'A–Z' : 'Z–A'}
          </Button>
          <Button onClick={() => { setEditing({}); setOpen(true) }} className="gap-2 w-full sm:w-auto">
            <Plus size={16} /> Add Branch
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {branchStats.map((b, i) => (
          <div key={b.id} className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors ${i < branchStats.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-gray-500" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-800">{b.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Users size={11} />{b.employeeCount} employee{b.employeeCount !== 1 ? 's' : ''}
                  </span>
                  {b.totalBasic > 0 && (
                    <span className="text-xs text-gray-400">· {formatTaka(b.totalBasic)} basic</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setEditing(b); setOpen(true) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => setDeleteConfirm(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {branchStats.length === 0 && (
          <div className="text-center py-16">
            <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">No branches yet</p>
            <p className="text-gray-300 text-xs mt-1">Add your first branch to get started</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing.id ? 'Edit Branch' : 'Add Branch'}</DialogTitle></DialogHeader>
          <div className="mt-2">
            <Label>Branch Name *</Label>
            <Input value={editing.name ?? ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Cox Branch" className="mt-1" autoFocus />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
            {deleteConfirm && branchStats.find(b => b.id === deleteConfirm.id)?.employeeCount! > 0 && (
              <span className="block mt-1 text-red-600">
                {branchStats.find(b => b.id === deleteConfirm.id)?.employeeCount} employee(s) will be unassigned.
              </span>
            )}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteBranch}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
