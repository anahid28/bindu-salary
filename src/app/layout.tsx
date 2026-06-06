import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bindu Premium — HR Manager',
  description: 'Automated salary sheet management for Bindu Premium',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.className} bg-gray-50 scrollbar-thin`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
