import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Eye, EyeOff, CheckCircle2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signUpUser } from '@/lib/auth'

type Step = 'details' | 'confirm-email'

interface FormData {
  fullName: string
  email: string
  phone: string
  telegram: string
  password: string
  confirmPassword: string
}

const initialForm: FormData = {
  fullName: '', email: '', phone: '', telegram: '', password: '', confirmPassword: '',
}

export default function Signup() {
  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<Partial<FormData & { general: string }>>({})
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setErrors(er => ({ ...er, [key]: '' }))
  }

  const validateDetails = () => {
    const e: Partial<FormData> = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Enter valid 10-digit Indian mobile'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Minimum 8 characters'
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateDetails()) return
    setLoading(true)
    try {
      await signUpUser({
        email: form.email,
        password: form.password,
        phone: form.phone,
        fullName: form.fullName,
        telegram: form.telegram || undefined,
      })
      setStep('confirm-email')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed. Please try again.'
      setErrors({ general: msg })
    } finally {
      setLoading(false)
    }
  }

  const inputCls = (err?: string) => cn(
    'w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all',
    err ? 'border-red-500/50' : 'border-white/10 hover:border-white/20',
  )

  return (
    <>
      <Helmet><title>Create Account — LeadPilot</title></Helmet>
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-24 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-brand-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center"><Zap size={18} className="text-white" fill="white" /></div>
              <span className="font-semibold text-white text-xl">Lead<span className="text-brand-400">Pilot</span></span>
            </Link>
          </div>
          <div className="glass rounded-2xl p-8">
            {step === 'details' ? (
              <>
                <div className="mb-8"><h1 className="text-2xl font-bold text-white mb-1">Create your account</h1><p className="text-slate-400 text-sm">Start getting leads in 48 hours</p></div>
                <form onSubmit={handleDetailsSubmit} className="space-y-4" noValidate>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Full name *</label><input type="text" placeholder="Rajesh Sharma" value={form.fullName} onChange={set('fullName')} className={inputCls(errors.fullName)} />{errors.fullName && <p className="mt-1 text-xs text-red-400">{errors.fullName}</p>}</div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Email address *</label><input type="email" placeholder="you@business.com" value={form.email} onChange={set('email')} className={inputCls(errors.email)} />{errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}</div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Phone number *</label><div className="flex gap-2"><div className="flex items-center bg-dark-800 border border-white/10 rounded-xl px-3 text-slate-400 text-sm flex-shrink-0">+91</div><input type="tel" placeholder="98765 43210" value={form.phone} onChange={set('phone')} className={cn(inputCls(errors.phone), 'flex-1')} /></div>{errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}</div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Telegram username <span className="text-slate-600 font-normal">(optional)</span></label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span><input type="text" placeholder="yourusername" value={form.telegram} onChange={set('telegram')} className={cn(inputCls(), 'pl-8')} /></div></div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label><div className="relative"><input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password} onChange={set('password')} className={inputCls(errors.password)} /><button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}</div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password *</label><div className="relative"><input type={showConfirm ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirmPassword} onChange={set('confirmPassword')} className={inputCls(errors.confirmPassword)} /><button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}</div>
                  {errors.general && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{errors.general}</div>}
                  <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all mt-2">{loading ? 'Creating account…' : 'Create account'}</button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-6">Already have an account? <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link></p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle2 size={32} className="text-green-400" /></div>
                <h1 className="text-2xl font-bold text-white mb-3">Confirm your email</h1>
                <p className="text-slate-400 text-sm mb-8">Supabase has sent a confirmation link to <span className="text-white font-medium">{form.email}</span>. Open it to activate your account, then sign in.</p>
                <Link to="/login" className="block w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3.5 rounded-xl transition-all">Go to sign in</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
