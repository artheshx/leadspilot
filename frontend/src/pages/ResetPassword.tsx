import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Eye, EyeOff, Zap, CheckCircle2 } from 'lucide-react'
import { resetPassword } from '@/lib/auth'
import { cn } from '@/lib/utils'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Minimum 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      await resetPassword(password)
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet><title>Reset Password — LeadPilot</title></Helmet>
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
            {done ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
                <p className="text-slate-400 text-sm mb-6">Your password has been reset successfully.</p>
                <button onClick={() => navigate('/login')} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3.5 rounded-xl transition-all">
                  Sign in →
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
                  <p className="text-slate-400 text-sm">Choose a strong password for your account</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError('') }}
                        className={cn('w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all pr-11', error ? 'border-red-500/50' : 'border-white/10 hover:border-white/20')}
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm new password</label>
                    <input
                      type="password"
                      placeholder="Re-enter password"
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError('') }}
                      className={cn('w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all', error ? 'border-red-500/50' : 'border-white/10 hover:border-white/20')}
                    />
                  </div>
                  {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{error}</div>}
                  <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all">
                    {loading ? 'Updating…' : 'Update password →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
