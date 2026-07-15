import { Helmet } from 'react-helmet-async'
import { useState } from 'react'
import { CheckCircle2, MessageSquare, Phone, Mail, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

type FormState = 'idle' | 'loading' | 'success' | 'error'

const budgetOptions = [
  'Under ₹10,000/month',
  '₹10,000 – ₹25,000/month',
  '₹25,000 – ₹75,000/month',
  '₹75,000 – ₹2,00,000/month',
  'Above ₹2,00,000/month',
]

const goalOptions = [
  'Generate leads',
  'Drive website traffic',
  'Increase walk-ins / footfall',
  'Boost app installs',
  'Brand awareness',
  'Other',
]

interface FormData {
  name: string
  phone: string
  email: string
  business: string
  industry: string
  budget: string
  goal: string
  message: string
}

const initialForm: FormData = {
  name: '', phone: '', email: '', business: '',
  industry: '', budget: '', goal: '', message: '',
}

export default function Contact() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [status, setStatus] = useState<FormState>('idle')
  const [errors, setErrors] = useState<Partial<FormData>>({})

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, '')))
      newErrors.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!form.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Enter a valid email'
    if (!form.business.trim()) newErrors.business = 'Business name is required'
    if (!form.budget) newErrors.budget = 'Please select a budget'
    if (!form.goal) newErrors.goal = 'Please select a campaign goal'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setStatus('loading')
    // Simulate API call — replace with your actual Supabase insert
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setStatus('success')
      setForm(initialForm)
    } catch {
      setStatus('error')
    }
  }

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )

  const inputClass = (hasError?: string) => cn(
    'w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all',
    hasError ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
  )

  return (
    <>
      <Helmet>
        <title>Get Started — LeadPilot</title>
        <meta name="description" content="Start your first Meta Ads campaign with LeadPilot. Fill in your brief and we'll have your campaign live in 48 hours." />
      </Helmet>

      <section className="pt-32 pb-24 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Left sidebar */}
            <div className="lg:col-span-2">
              <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Get started</p>
              <h1 className="text-4xl font-bold text-white mb-4">
                Tell us about<br />your business
              </h1>
              <p className="text-slate-400 leading-relaxed mb-8">
                Fill the form and our team will reach out within 2 business hours. We'll understand your goals and recommend the right plan.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: Phone, label: '+91 98765 43210' },
                  { icon: Mail, label: 'hello@leadpilot.in' },
                  { icon: MapPin, label: 'Indore, Madhya Pradesh' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-slate-400 text-sm">
                    <div className="w-8 h-8 glass rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon size={14} className="text-brand-400" />
                    </div>
                    {label}
                  </div>
                ))}
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <MessageSquare size={18} className="text-brand-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium mb-1">Prefer WhatsApp?</p>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Message us directly. We typically respond within 30 minutes during business hours.
                    </p>
                    <a
                      href="https://wa.me/919876543210"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-xs font-medium text-white bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg transition-colors"
                    >
                      Chat on WhatsApp →
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              {status === 'success' ? (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">We've received your brief!</h2>
                  <p className="text-slate-400 leading-relaxed max-w-md mx-auto">
                    Our team will reach out within 2 business hours. Check your WhatsApp and email — we'll send a confirmation shortly.
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-6 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Submit another enquiry →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-5" noValidate>
                  <h2 className="text-xl font-bold text-white mb-6">Campaign brief</h2>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Your name *" error={errors.name}>
                      <input
                        type="text"
                        placeholder="Rajesh Sharma"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className={inputClass(errors.name)}
                      />
                    </Field>
                    <Field label="WhatsApp / Phone *" error={errors.phone}>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className={inputClass(errors.phone)}
                      />
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Email address *" error={errors.email}>
                      <input
                        type="email"
                        placeholder="you@business.com"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className={inputClass(errors.email)}
                      />
                    </Field>
                    <Field label="Business name *" error={errors.business}>
                      <input
                        type="text"
                        placeholder="Sharma Electronics"
                        value={form.business}
                        onChange={e => setForm(f => ({ ...f, business: e.target.value }))}
                        className={inputClass(errors.business)}
                      />
                    </Field>
                  </div>

                  <Field label="Industry / Type of business">
                    <input
                      type="text"
                      placeholder="e.g. Retail, Real estate, Fitness, Healthcare…"
                      value={form.industry}
                      onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                      className={inputClass()}
                    />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Monthly ad budget *" error={errors.budget}>
                      <select
                        value={form.budget}
                        onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                        className={cn(inputClass(errors.budget), 'cursor-pointer')}
                      >
                        <option value="">Select budget range</option>
                        {budgetOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Campaign goal *" error={errors.goal}>
                      <select
                        value={form.goal}
                        onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                        className={cn(inputClass(errors.goal), 'cursor-pointer')}
                      >
                        <option value="">What do you want?</option>
                        {goalOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Anything else we should know?">
                    <textarea
                      rows={3}
                      placeholder="Target cities, past experience with ads, specific requirements…"
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className={cn(inputClass(), 'resize-none')}
                    />
                  </Field>

                  {status === 'error' && (
                    <p className="text-red-400 text-sm text-center">
                      Something went wrong. Please try again or WhatsApp us directly.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-brand-600/30 text-sm"
                  >
                    {status === 'loading' ? 'Submitting…' : 'Submit campaign brief →'}
                  </button>

                  <p className="text-xs text-slate-600 text-center">
                    No payment required. We'll contact you to discuss next steps.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
