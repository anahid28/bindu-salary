'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { CommandPalette, useCommandPalette } from '@/components/shared/CommandPalette'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette()

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-slate-50">
      <Sidebar onOpenCommandPalette={() => setOpen(true)} />
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">{children}</main>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  )
}
