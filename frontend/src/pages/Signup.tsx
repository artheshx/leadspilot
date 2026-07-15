import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Eye, EyeOff, CheckCircle2, Zap, ArrowLeft, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import OtpInput from '@/components/ui/OtpInput'
import { signUpUser, verifyOtp, resendOtp } from '@/lib/auth'

type Step = 'details' | 'verify-email' | 'verify-phone' | 'done'

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
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<Partial<FormData & { general: string }>>({})
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setErrors(er => ({ ...er, [key]: '' }))
  }

  // ── Validate step 1 ──
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

  // ── Submit details ──
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateDetails()) return
    setLoading(true)
    try {
      const user = await signUpUser({
        email: form.email,
        password: form.password,
        phone: form.phone,
        fullName: form.fullName,
        telegram: form.telegram || undefined,
      })
      setUserId(user.id)
      setStep('verify-email')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed. Please try again.'
      setErrors({ general: msg })
    } finally {
      setLoading(false)
    }
  }

  // ── Verify email OTP ──
  const handleEmailOtp = async () => {
    if (emailOtp.length < 6) { setOtpError('Enter the 6-digit code'); return }
    setLoading(true); setOtpError('')
    const result = await verifyOtp(userId, 'email', emailOtp)
    setLoading(false)
    if (result.success) {
      setStep('verify-phone')
    } else {
      setOtpError(result.error ?? 'Verification failed')
    }
  }

  // ── Verify phone OTP ──
  const handlePhoneOtp = async () => {
    if (phoneOtp.length < 6) { setOtpError('Enter the 6-digit code'); return }
    setLoading(true); setOtpError('')
    const result = await verifyOtp(userId, 'phone', phoneOtp)
    setLoading(false)
    if (result.success) {
      setStep('done')
    } else {
      setOtpError(result.error ?? 'Verification failed')
    }
  }

  // ── Resend OTP ──
  const handleResend = async (type: 'email' | 'phone') => {
    if (resendCooldown > 0) return
    await resendOtp(userId, type, type === 'email' ? form.email : form.phone)
    setResendCooldown(30)
    const timer = setInterval(() => {
      setResendCooldown(c => { if (c <= 1) { clearInterval(timer); return 0 } return c - 1 })
    }, 1000)
  }

  const inputCls = (err?: string) => cn(
    'w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all',
    err ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
  )

  return (
    <>
      <Helmet>
        <title>Create Account — LeadPilot</title>
      </Helmet>

      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-24 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-brand-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
                <Zap size={18} className="text-white" fill="white" />
              </div>
              <span className="font-semibold text-white text-xl">Lead<span className="text-brand-400">Pilot</span></span>
            </Link>
          </div>

          <div className="glass rounded-2xl p-8">

            {/* ── STEP: DETAILS ── */}
            {step === 'details' && (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
                  <p className="text-slate-400 text-sm">Start getting leads in 48 hours</p>
                </div>

                {/* Progress */}
                <div className="flex gap-2 mb-8">
                  {['Account details', 'Verify email', 'Verify phone'].map((label, i) => (
                    <div key={label} className="flex-1">
                      <div className={cn('h-1 rounded-full', i === 0 ? 'bg-brand-500' : 'bg-white/10')} />
                      <p className="text-xs text-slate-600 mt-1 hidden sm:block">{label}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleDetailsSubmit} className="space-y-4" noValidate>
                  {/* Full name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name *</label>
                    <input type="text" placeholder="Rajesh Sharma" value={form.fullName} onChange={set('fullName')} className={inputCls(errors.fullName)} />
                    {errors.fullName && <p className="mt-1 text-xs text-red-400">{errors.fullName}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address *</label>
                    <input type="email" placeholder="you@business.com" value={form.email} onChange={set('email')} className={inputCls(errors.email)} />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone number *</label>
                    <div className="flex gap-2">
                      <div className="flex items-center bg-dark-800 border border-white/10 rounded-xl px-3 text-slate-400 text-sm flex-shrink-0">
                        +91
                      </div>
                      <input type="tel" placeholder="98765 43210" value={form.phone} onChange={set('phone')} className={cn(inputCls(errors.phone), 'flex-1')} />
                    </div>
                    {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
                  </div>

                  {/* Telegram (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Telegram username <span className="text-slate-600 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                      <input type="text" placeholder="yourusername" value={form.telegram} onChange={set('telegram')} className={cn(inputCls(), 'pl-8')} />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={form.password}
                        onChange={set('password')}
                        className={cn(inputCls(errors.password), 'pr-11')}
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm password *</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={form.confirmPassword}
                        onChange={set('confirmPassword')}
                        className={cn(inputCls(errors.confirmPassword), 'pr-11')}
                      />
                      <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}
                  </div>

                  {errors.general && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                      {errors.general}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all mt-2"
                  >
                    {loading ? 'Creating account…' : 'Continue →'}
                  </button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-6">
                  Already have an account?{' '}
                  <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
                </p>
              </>
            )}

            {/* ── STEP: VERIFY EMAIL ── */}
            {step === 'verify-email' && (
              <>
                <button onClick={() => setStep('details')} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="flex gap-2 mb-8">
                  {['Account details', 'Verify email', 'Verify phone'].map((label, i) => (
                    <div key={label} className="flex-1">
                      <div className={cn('h-1 rounded-full', i <= 1 ? 'bg-brand-500' : 'bg-white/10')} />
                    </div>
                  ))}
                </div>

                <div className="text-center mb-8">
                  <div className="w-14 h-14 glass-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📧</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Verify your email</h2>
                  <p className="text-slate-400 text-sm">
                    We sent a 6-digit code to<br />
                    <span className="text-white font-medium">{form.email}</span>
                  </p>
                </div>

                <div className="mb-6">
                  <OtpInput value={emailOtp} onChange={setEmailOtp} error={otpError} disabled={loading} />
                </div>

                <button
                  onClick={handleEmailOtp}
                  disabled={loading || emailOtp.length < 6}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all mb-4"
                >
                  {loading ? 'Verifying…' : 'Verify email →'}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => handleResend('email')}
                    disabled={resendCooldown > 0}
                    className="text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 mx-auto"
                  >
                    <RefreshCw size={12} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP: VERIFY PHONE ── */}
            {step === 'verify-phone' && (
              <>
                <div className="flex gap-2 mb-8">
                  {['Account details', 'Verify email', 'Verify phone'].map((label, i) => (
                    <div key={label} className="flex-1">
                      <div className={cn('h-1 rounded-full', i <= 2 ? 'bg-brand-500' : 'bg-white/10')} />
                    </div>
                  ))}
                </div>

                <div className="text-center mb-8">
                  <div className="w-14 h-14 glass-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📱</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Verify your phone</h2>
                  <p className="text-slate-400 text-sm">
                    We sent a 6-digit code via SMS to<br />
                    <span className="text-white font-medium">+91 {form.phone}</span>
                  </p>
                </div>

                <div className="mb-6">
                  <OtpInput value={phoneOtp} onChange={setPhoneOtp} error={otpError} disabled={loading} />
                </div>

                <button
                  onClick={handlePhoneOtp}
                  disabled={loading || phoneOtp.length < 6}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all mb-4"
                >
                  {loading ? 'Verifying…' : 'Verify phone →'}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => handleResend('phone')}
                    disabled={resendCooldown > 0}
                    className="text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 mx-auto"
                  >
                    <RefreshCw size={12} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP: DONE ── */}
            {step === 'done' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={32} className="text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Account created! 🎉</h2>
                <p className="text-slate-400 text-sm mb-8">
                  Both your email and phone have been verified. Welcome to LeadPilot!
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3.5 rounded-xl transition-all"
                >
                  Go to dashboard →
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
