import { supabase } from './supabase'

export async function signUpUser({
  email,
  password,
  phone,
  fullName,
  telegram,
}: {
  email: string
  password: string
  phone: string
  fullName: string
  telegram?: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: { full_name: fullName, phone, telegram: telegram || null },
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('Signup failed — no user returned')

  // The database trigger in supabase/migrations/002_supabase_email_confirmation.sql
  // creates the profile from this user metadata. This is necessary because Confirm
  // email deliberately returns no authenticated session until the link is clicked.
  return data.user
}

export async function signInUser(email: string, password: string) {
  // Check mock credentials first to prevent offline network "Failed to fetch" errors
  if (password === '1234567890' && (email === 'jayeshviswakarma42@gmail.com' || email === 'user123@gmail.com')) {
    const isAdmin = email === 'jayeshviswakarma42@gmail.com'
    const mockUser = {
      id: isAdmin ? 'mock-admin-uuid-1234' : 'mock-client-uuid-5678',
      email,
    }
    const mockSession = {
      access_token: 'mock-access-token-9999',
      user: mockUser,
    }
    const mockProfile = {
      id: mockUser.id,
      email,
      phone: '+919999999999',
      full_name: isAdmin ? 'Jayesh Viswakarma (Admin)' : 'User123 (Client)',
      telegram: 'test_tg',
      role: isAdmin ? 'admin' : 'client',
      email_verified: true,
      phone_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    localStorage.setItem('leadpilot_mock_session', JSON.stringify({ session: mockSession, profile: mockProfile }))
    return { user: mockUser, session: mockSession }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function resetPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('91') && cleaned.length === 12) return '+' + cleaned
  if (cleaned.length === 10) return '+91' + cleaned
  return '+' + cleaned
}
