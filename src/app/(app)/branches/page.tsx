'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Branch>>({})
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await supabase.from('branches').select('*').order('name')
    setBranches(data ?? [])
  }

  useEffect(() => { load() }, [])

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

  async function deleteBranch(id: string) {
    if (!confirm('Delete this branch? Employees in this branch will be unassigned.')) return
    const { error } = await supabase.from('branches').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Branch deleted'); load() }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-500 text-sm mt-0.5">{branches.length} branches</p>
        </div>
        <Button onClick={() => { setEditing({}); setOpen(true) }} className="gap-2">
          <Plus size={16} /> Add Branch
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {branches.map((b, i) => (
          <div key={b.id} className={`flex items-center justify-between px-5 py-3.5 ${i < branches.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <span className="font-medium text-gray-800">{b.name}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditing(b); setOpen(true) }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                <Pencil size={14} />
              </button>
              <button onClick={() => deleteBranch(b.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {branches.length === 0 && <p className="text-center text-gray-400 py-12">No branches yet</p>}
      </div>

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
    </div>
  )
}
