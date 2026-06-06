'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTaka } from '@/lib/calculations'
import type { Employee, Branch } from '@/types'
import { Phone, Calendar, Droplets, CreditCard, MapPin, UserCircle, Briefcase, Banknote, ExternalLink, Pencil } from 'lucide-react'

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

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function Field({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={14} className="mt-0.5 text-gray-400 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-1">{title}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {children}
      </div>
    </div>
  )
}

interface Props {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: () => void
}

export function EmployeeProfileModal({ employee, open, onOpenChange, onEdit }: Props) {
  if (!employee) return null

  const branch = employee.branch as unknown as Branch | undefined
  const branchName = branch?.name ?? '—'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Employee Profile</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${avatarColor(employee.id)}`}>
            {getInitials(employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{employee.name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">{employee.employee_id}</Badge>
              <Badge variant="outline" className="text-xs px-1.5 py-0">{branchName}</Badge>
              <Badge
                variant={employee.active ? 'default' : 'secondary'}
                className={`text-xs px-1.5 py-0 ${employee.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}`}
              >
                {employee.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 pt-1">
          <Section title="Role & Tenure">
            <Field label="Designation" value={employee.designation} icon={Briefcase} />
            <Field label="Branch" value={branchName} icon={UserCircle} />
            <Field label="Joining Date" value={employee.joining_date} icon={Calendar} />
            {employee.old_id_card && (
              <Field label="Old ID Card" value={employee.old_id_card} icon={CreditCard} />
            )}
          </Section>

          <Section title="Compensation">
            <div className="flex items-start gap-2.5">
              <Banknote size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Basic Salary</p>
                <p className="text-sm text-gray-800 font-medium">{formatTaka(employee.basic_salary)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Banknote size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Conveyance</p>
                <p className="text-sm text-gray-800 font-medium">{formatTaka(employee.conveyance)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Calendar size={14} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Yearly Leave</p>
                <p className="text-sm text-gray-800 font-medium">{employee.yearly_leave_allowance} days</p>
              </div>
            </div>
          </Section>

          <Section title="Personal">
            <Field label="Date of Birth" value={employee.date_of_birth} icon={Calendar} />
            <Field label="Blood Group" value={employee.blood_group} icon={Droplets} />
            <Field label="Mobile Number" value={employee.mobile_number} icon={Phone} />
            <Field label="NID Number" value={employee.nid_number} icon={CreditCard} />
          </Section>

          {(employee.address || employee.emergency_contact) && (
            <Section title="Contact">
              {employee.address && (
                <div className="col-span-2 flex items-start gap-2.5">
                  <MapPin size={14} className="mt-0.5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Address</p>
                    <p className="text-sm text-gray-800 font-medium">{employee.address}</p>
                  </div>
                </div>
              )}
              <Field label="Emergency Contact" value={employee.emergency_contact} icon={Phone} />
            </Section>
          )}

          {employee.photo_url && (
            <Section title="Documents">
              <div className="col-span-2">
                <a
                  href={employee.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink size={13} />
                  View Passport Photo
                </a>
              </div>
            </Section>
          )}
        </div>

        {onEdit && (
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit() }} className="gap-1.5">
              <Pencil size={14} /> Edit Employee
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
