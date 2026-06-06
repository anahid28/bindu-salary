'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MONTHS } from '@/types'
import { formatTaka } from '@/lib/calculations'
import { Users, Building2, DollarSign, FileText, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const [stats, setStats] = useState({ employees: 0, branches: 0 })
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  useEffect(() => {
    async function load() {
      const [{ count: emp }, { count: br }] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('branches').select('*', { count: 'exact', head: true }),
      ])
      setStats({ employees: emp ?? 0, branches: br ?? 0 })
    }
    load()
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {MONTHS[currentMonth - 1]} {currentYear} — Bindu Premium Salary Manager
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.employees}</p>
            <p className="text-sm text-gray-500">Active Employees</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Building2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.branches}</p>
            <p className="text-sm text-gray-500">Branches</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-3">
        {[
          {
            href: `/salary?month=${currentMonth}&year=${currentYear}`,
            icon: DollarSign,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            title: `Process ${MONTHS[currentMonth - 1]} ${currentYear} Salary`,
            desc: 'Input advance, leave, late & OT for all employees',
          },
          {
            href: `/slips?month=${currentMonth}&year=${currentYear}`,
            icon: FileText,
            color: 'text-teal-600',
            bg: 'bg-teal-50',
            title: 'View & Print Salary Slips',
            desc: 'Branch-wise salary slips, download PDF',
          },
          {
            href: '/employees',
            icon: Users,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            title: 'Manage Employees',
            desc: 'Add, edit or deactivate employees',
          },
          {
            href: '/eid',
            icon: FileText,
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            title: 'Eid Bonus Sheet',
            desc: 'Process Eid salary payment + bonus',
          },
        ].map(({ href, icon: Icon, color, bg, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
