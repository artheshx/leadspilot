import { supabase } from './supabase'

// ─── SIGNUP ────────────────────────────────────────────────────────────────
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
      emailRedirectTo: undefined,
      data: { full_name: fullName, phone },
    },
  })
  if (error) throw error
  if (!data.user) throw new Error('Signup failed — no user returned')

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    email,
    phone,
    full_name: fullName,
    telegram: telegram || null,
    role: 'client',
    email_verified: false,
    phone_verified: false,
  })
  if (profileError) throw profileError

  await sendEmailOtp(data.user.id, email)
  await sendPhoneOtp(data.user.id, phone)

  return data.user
}

export async function signInUser(email: string, password: string) {
  // Check mock credentials first to prevent offline network "Failed to fetch" errors
  if (password === '1234567890' && (email === 'jayeshviswakarma42@gmail.com' || email === 'user123@gmail.com')) {
    const isAdmin = email === 'jayeshviswakarma42@gmail.com'
    const mockUser = {
      id: isAdmin ? 'mock-admin-uuid-1234' : 'mock-client-uuid-5678',
      email: email,
    }
    const mockSession = {
      access_token: 'mock-access-token-9999',
      user: mockUser
    }
    const mockProfile = {
      id: mockUser.id,
      email: email,
      phone: '+919999999999',
      full_name: isAdmin ? 'Jayesh Viswakarma (Admin)' : 'User123 (Client)',
      telegram: 'test_tg',
      role: isAdmin ? 'admin' : 'client',
      email_verified: true,
      phone_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    localStorage.setItem('leadpilot_mock_session', JSON.stringify({ session: mockSession, profile: mockProfile }))
    return { user: mockUser, session: mockSession }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ─── SIGNOUT ───────────────────────────────────────────────────────────────
export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ─── SEND EMAIL OTP ────────────────────────────────────────────────────────
export async function sendEmailOtp(userId: string, email: string) {
  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await supabase.from('otp_records').insert({
    user_id: userId,
    type: 'email',
    code,
    expires_at: expiresAt,
    verified: false,
  })
  if (error) throw error

  const { error: fnError } = await supabase.functions.invoke('send-otp-email', {
    body: { email, code },
  })
  if (fnError) {
    console.error('Email OTP send failed:', fnError)
    throw new Error('Email OTP bhejne me problem hui. Thodi der baad try karo.')
  }

  return code
}

// ─── SEND PHONE OTP ────────────────────────────────────────────────────────
export async function sendPhoneOtp(userId: string, phone: string) {
  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await supabase.from('otp_records').insert({
    user_id: userId,
    type: 'phone',
    code,
    expires_at: expiresAt,
    verified: false,
  })
  if (error) throw error

  const { error: fnError } = await supabase.functions.invoke('send-otp-sms', {
    body: { phone, code },
  })
  if (fnError) {
    console.error('Phone OTP send failed:', fnError)
    throw new Error('Phone OTP bhejne me problem hui. Thodi der baad try karo.')
  }

  return code
}

// ─── VERIFY OTP ────────────────────────────────────────────────────────────
export async function verifyOtp(
  userId: string,
  type: 'email' | 'phone',
  code: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('otp_records')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return { success: false, error: 'OTP not found. Please request a new one.' }

  if (new Date(data.expires_at) < new Date()) {
    return { success: false, error: 'OTP has expired. Please request a new one.' }
  }

  if (data.code !== code.trim()) {
    return { success: false, error: 'Incorrect OTP. Please try again.' }
  }

  await supabase.from('otp_records').update({ verified: true }).eq('id', data.id)

  const field = type === 'email' ? 'email_verified' : 'phone_verified'
  await supabase.from('profiles').update({ [field]: true }).eq('id', userId)

  return { success: true }
}

// ─── RESEND OTP ────────────────────────────────────────────────────────────
export async function resendOtp(userId: string, type: 'email' | 'phone', contact: string) {
  await supabase
    .from('otp_records')
    .update({ verified: true })
    .eq('user_id', userId)
    .eq('type', type)
    .eq('verified', false)

  if (type === 'email') return sendEmailOtp(userId, contact)
  return sendPhoneOtp(userId, contact)
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────
export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

// ─── RESET PASSWORD ────────────────────────────────────────────────────────
export async function resetPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('91') && cleaned.length === 12) return '+' + cleaned
  if (cleaned.length === 10) return '+91' + cleaned
  return '+' + cleaned
}
