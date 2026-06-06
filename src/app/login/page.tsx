'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password')
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2340] via-[#1e2a4a] to-[#243052] flex items-center justify-center p-4">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo + Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 mb-4 shadow-xl shadow-black/20">
            <Image src="/bindu-logo.png" alt="Bindu" width={40} height={40} className="rounded-lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">Bindu Premium</h1>
          <p className="text-sm text-white/50 mt-1">Salary Manager · Admin Login</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 border border-white/10 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <div className="relative mt-1.5">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@bindupremium.com"
                  className="pl-9 h-11 transition-shadow focus:ring-2 focus:ring-[#1a2340]/20"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative mt-1.5">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11 transition-shadow focus:ring-2 focus:ring-[#1a2340]/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_0.2s_ease-out]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#1a2340] hover:bg-[#243052] text-white font-medium transition-all hover:shadow-lg hover:shadow-[#1a2340]/20"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          Bindu Premium · Internal Use Only
        </p>
      </div>
    </div>
  )
}
