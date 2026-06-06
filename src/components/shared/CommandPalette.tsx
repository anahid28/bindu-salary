'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  LayoutDashboard, Users, Building2, DollarSign, FileText,
  CalendarDays, Gift, Settings, ArrowRight, Search,
} from 'lucide-react'

type CommandItem = {
  label: string
  href: string
  icon: React.ElementType
  category: string
}

const PAGES: CommandItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, category: 'Pages' },
  { label: 'Employees', href: '/employees', icon: Users, category: 'Pages' },
  { label: 'Branches', href: '/branches', icon: Building2, category: 'Pages' },
  { label: 'Salary Processing', href: '/salary', icon: DollarSign, category: 'Pages' },
  { label: 'Salary Slips', href: '/slips', icon: FileText, category: 'Pages' },
  { label: 'Monthly Feed', href: '/feed', icon: CalendarDays, category: 'Pages' },
  { label: 'Eid Bonus', href: '/eid', icon: Gift, category: 'Pages' },
  { label: 'Settings', href: '/settings', icon: Settings, category: 'Pages' },
]

const ACTIONS: CommandItem[] = [
  { label: 'Process Current Month Salary', href: '/salary', icon: DollarSign, category: 'Actions' },
  { label: 'View Salary Slips', href: '/slips', icon: FileText, category: 'Actions' },
  { label: 'Add New Employee', href: '/employees', icon: Users, category: 'Actions' },
  { label: 'View Monthly Feed', href: '/feed', icon: CalendarDays, category: 'Actions' },
  { label: 'Download Eid Bonus PDF', href: '/eid', icon: Gift, category: 'Actions' },
]

const ALL_ITEMS = [...PAGES, ...ACTIONS]

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query
    ? ALL_ITEMS.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
    : ALL_ITEMS

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const navigate = useCallback((href: string) => {
    router.push(href)
    onOpenChange(false)
  }, [router, onOpenChange])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => (prev - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault()
      navigate(filtered[selectedIdx].href)
    }
  }

  // Group by category
  const grouped = filtered.reduce((acc, item, idx) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push({ ...item, idx })
    return acc
  }, {} as Record<string, (CommandItem & { idx: number })[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-200">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 h-12 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none border-0"
          />
          <kbd className="hidden sm:inline text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{category}</p>
              {items.map((item) => {
                const Icon = item.icon
                const isSelected = item.idx === selectedIdx
                return (
                  <button
                    key={item.label + item.category}
                    data-idx={item.idx}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setSelectedIdx(item.idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {isSelected && <ArrowRight size={14} className="text-blue-400" />}
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-sm">
              No results for "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded border">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded border">↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded border">esc</kbd> Close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Hook to manage command palette state + keyboard shortcut */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { open, setOpen }
}
