'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, DollarSign, FileText, Gift, Settings, LayoutDashboard, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/branches', label: 'Branches', icon: Building2 },
  { href: '/salary', label: 'Salary Processing', icon: DollarSign },
  { href: '/slips', label: 'Salary Slips', icon: FileText },
  { href: '/eid', label: 'Eid Bonus', icon: Gift },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-60 shrink-0 bg-[#1a2340] text-white flex flex-col min-h-screen">
      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-xs font-semibold tracking-widest text-white/50 uppercase">Bindu Premium</p>
        <p className="text-lg font-bold mt-0.5">Salary Manager</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-white/30">v1.0 · Bindu Premium</p>
      </div>
    </aside>
  )
}
