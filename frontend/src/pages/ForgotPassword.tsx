import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Zap, CheckCircle2 } from 'lucide-react'
import { forgotPassword } from '@/lib/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address'); return }
    setLoading(true); setError('')
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet><title>Forgot Password — LeadPilot</title></Helmet>

      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-24 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
                <Zap size={18} className="text-white" fill="white" />
              </div>
              <span className="font-semibold text-white text-xl">Lead<span className="text-brand-400">Pilot</span></span>
            </Link>
          </div>

          <div className="glass rounded-2xl p-8">
            {sent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
                <p className="text-slate-400 text-sm mb-6">
                  We sent a password reset link to <span className="text-white">{email}</span>. Check your inbox (and spam folder).
                </p>
                <Link to="/login" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
                  <p className="text-slate-400 text-sm">Enter your email and we'll send you a reset link</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                    <input
                      type="email"
                      placeholder="you@business.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      className="w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all"
                  >
                    {loading ? 'Sending…' : 'Send reset link →'}
                  </button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-6">
                  Remembered it?{' '}
                  <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
