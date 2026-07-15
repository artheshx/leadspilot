import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, type User, type Session } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, pass: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data as Profile)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  const signIn = async (email: string, pass: string) => {
    // Check mock credentials first to prevent offline network "Failed to fetch" errors
    if (pass === '1234567890' && (email === 'jayeshviswakarma42@gmail.com' || email === 'user123@gmail.com')) {
      const isAdmin = email === 'jayeshviswakarma42@gmail.com'
      const mockUser = {
        id: isAdmin ? 'mock-admin-uuid-1234' : 'mock-client-uuid-5678',
        email: email,
      } as User
      const mockSession = {
        access_token: 'mock-access-token-9999',
        user: mockUser
      } as Session
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
      } as Profile
      localStorage.setItem('leadpilot_mock_session', JSON.stringify({ session: mockSession, profile: mockProfile }))
      setSession(mockSession)
      setUser(mockUser)
      setProfile(mockProfile)
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) throw error
    if (data.session) {
      setSession(data.session)
      setUser(data.user)
      await fetchProfile(data.user.id)
    }
  }

  useEffect(() => {
    // Check mock session first
    const mockSaved = localStorage.getItem('leadpilot_mock_session')
    if (mockSaved) {
      try {
        const parsed = JSON.parse(mockSaved)
        setSession(parsed.session)
        setUser(parsed.session.user)
        setProfile(parsed.profile)
        setLoading(false)
        return
      } catch (e) {
        console.error(e)
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // If mock session is active, ignore auth state changes to avoid overriding
        if (localStorage.getItem('leadpilot_mock_session')) return

        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    localStorage.removeItem('leadpilot_mock_session')
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error(e)
    }
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
