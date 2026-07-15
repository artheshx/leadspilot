import { createClient } from '@supabase/supabase-js'

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(envSupabaseUrl && envSupabaseAnonKey)

const supabaseUrl = envSupabaseUrl || 'https://placeholder.supabase.co'
const supabaseAnonKey = envSupabaseAnonKey || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export type { User, Session } from '@supabase/supabase-js'
