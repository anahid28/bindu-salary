import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ email: data.user.email })
}

export async function PATCH(req: Request) {
  const { userId, password } = await req.json()
  if (!userId || !password) {
    return NextResponse.json({ error: 'userId and password are required' }, { status: 400 })
  }

  const supabase = adminClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, { password })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function GET() {
  const supabase = adminClient()
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data.users.map(u => ({ id: u.id, email: u.email })))
}
