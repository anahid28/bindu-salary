'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Users, DollarSign, FileText, Gift, Settings, LayoutDashboard, Building2, LogOut, Menu, X, CalendarDays, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/branches', label: 'Branches', icon: Building2 },
  { href: '/salary', label: 'Salary Processing', icon: DollarSign },
  { href: '/slips', label: 'Salary Slips', icon: FileText },
  { href: '/feed', label: 'Monthly Feed', icon: CalendarDays },
  { href: '/eid', label: 'Eid Bonus', icon: Gift },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function SidebarContent({ onNavClick, onOpenCommandPalette }: { onNavClick?: () => void; onOpenCommandPalette?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div className="px-5 py-4 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bindu-logo-white.png" alt="Bindu Premium" className="h-10 w-auto" />
        <p className="text-xs text-white/40 mt-1.5 tracking-wide">HR Management</p>
      </div>
      {onOpenCommandPalette && (
        <div className="px-3 pt-3">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/40 bg-white/5 hover:bg-white/10 hover:text-white/60 transition-colors"
          >
            <Search size={14} />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Ctrl+K</kbd>
          </button>
        </div>
      )}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              pathname === href
                ? 'bg-white/15 text-white shadow-sm shadow-white/5'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon size={17} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-3 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={17} />
          Sign Out
        </button>
        <p className="text-xs text-white/20 px-3 mt-2">v1.0 · Bindu Premium</p>
      </div>
    </>
  )
}

export function Sidebar({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change (mobile)
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#1a2340] text-white shadow-lg shadow-black/20 hover:bg-[#243052] transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-full w-72 bg-[#1a2340] text-white flex flex-col z-50 transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} onOpenCommandPalette={onOpenCommandPalette} />
      </aside>

      {/* Desktop sidebar (always visible on lg+) */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#1a2340] text-white flex-col min-h-screen sticky top-0 h-screen">
        <SidebarContent onOpenCommandPalette={onOpenCommandPalette} />
      </aside>
    </>
  )
}
