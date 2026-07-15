import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, User, Lock, Bell, Building, Image } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'

type SettingsTab = 'profile' | 'business' | 'brand' | 'security'

export default function Settings() {
  const { profile, refreshProfile, user } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // Profile fields
  const [name, setName] = useState(profile?.full_name ?? '')
  const [telegram, setTelegram] = useState(profile?.telegram ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Password fields
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [changingPass, setChangingPass] = useState(false)
  const [passSaved, setPassSaved] = useState(false)
  const [passError, setPassError] = useState('')

  // Business Info & Brand assets (Persisted in localStorage to avoid db modifications)
  const [businessName, setBusinessName] = useState('')
  const [businessDesc, setBusinessDesc] = useState('')
  const [industry, setIndustry] = useState('')
  const [brandColor, setBrandColor] = useState('#2563eb')
  const [brandStyle, setBrandStyle] = useState('modern')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandSaved, setBrandSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(profile?.full_name ?? '')
    setTelegram(profile?.telegram ?? '')

    const localSettings = localStorage.getItem(`leadpilot_settings_brand_${user.id}`)
    if (localSettings) {
      const parsed = JSON.parse(localSettings)
      setBusinessName(parsed.businessName ?? '')
      setBusinessDesc(parsed.businessDesc ?? '')
      setIndustry(parsed.industry ?? '')
      setBrandColor(parsed.brandColor ?? '#2563eb')
      setBrandStyle(parsed.brandStyle ?? 'modern')
      setLogoUrl(parsed.logoUrl ?? '')
    }
  }, [profile, user])

  const handleProfileSave = async () => {
    if (!name.trim()) return
    setSaving(true); setSaved(false); setSaveError('')
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), telegram: telegram.trim() || null })
      .eq('id', profile!.id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSaveBrandAndBusiness = () => {
    if (!user) return
    const payload = {
      businessName,
      businessDesc,
      industry,
      brandColor,
      brandStyle,
      logoUrl
    }
    localStorage.setItem(`leadpilot_settings_brand_${user.id}`, JSON.stringify(payload))
    setBrandSaved(true)
    setTimeout(() => setBrandSaved(false), 3000)
  }

  const handlePasswordChange = async () => {
    setPassError('')
    if (!newPass) { setPassError('New password is required'); return }
    if (newPass.length < 8) { setPassError('Minimum 8 characters'); return }
    if (newPass !== confirmPass) { setPassError('Passwords do not match'); return }
    setChangingPass(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setChangingPass(false)
    if (error) { setPassError(error.message); return }
    setNewPass(''); setConfirmPass('')
    setPassSaved(true)
    setTimeout(() => setPassSaved(false), 3000)
  }

  const inputCls = cn(
    'w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all'
  )

  const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'business', label: 'Business Details', icon: Building },
    { id: 'brand', label: 'Brand Assets', icon: Image },
    { id: 'security', label: 'Security & Auth', icon: Lock }
  ]

  return (
    <>
      <Helmet><title>Account Settings — LeadPilot</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Configure profile details and brand identity parameters.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {/* Tabs Sidebar */}
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2.5 md:pb-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 text-left w-full border',
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white border-brand-500/25 shadow-md font-bold'
                    : 'glass text-slate-400 hover:text-white border-white/5'
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="md:col-span-3 space-y-6">
            {activeTab === 'profile' && (
              /* Profile Section */
              <div className="glass rounded-2xl p-6 space-y-5 border border-white/5 shadow-lg">
                <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
                  <User size={18} className="text-brand-400" />
                  <h2 className="text-base font-bold text-white">Profile settings</h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email address</label>
                    <input type="email" value={profile?.email ?? ''} disabled className={cn(inputCls, 'opacity-50 cursor-not-allowed')} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone number</label>
                    <input type="tel" value={profile?.phone ?? ''} disabled className={cn(inputCls, 'opacity-50 cursor-not-allowed')} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Telegram username <span className="text-slate-600 font-normal lowercase">(for real-time lead alerts)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                    <input type="text" placeholder="yourusername" value={telegram} onChange={e => setTelegram(e.target.value)} className={cn(inputCls, 'pl-8')} />
                  </div>
                </div>

                <div className="flex gap-1.5 pt-1 text-xs">
                  <CheckCircle2 size={13} className={profile?.email_verified ? 'text-green-400' : 'text-slate-600'} />
                  <span className={profile?.email_verified ? 'text-green-400 font-medium' : 'text-slate-500'}>
                    Email verified
                  </span>
                </div>

                {saveError && <p className="text-xs text-red-400">{saveError}</p>}

                <button
                  onClick={handleProfileSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition-all shadow-md shadow-brand-600/10"
                >
                  {saved ? <><CheckCircle2 size={13} /> Saved</> : saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {activeTab === 'business' && (
              /* Business Info Section */
              <div className="glass rounded-2xl p-6 space-y-5 border border-white/5 shadow-lg">
                <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
                  <Building size={18} className="text-brand-400" />
                  <h2 className="text-base font-bold text-white">Business Information</h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Business / Store name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma Electronics"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Industry sector</label>
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-all"
                  >
                    <option value="">Select industry</option>
                    <option value="Healthcare">Healthcare & Clinics</option>
                    <option value="Fitness">Sports & Fitness Gyms</option>
                    <option value="Education">E-learning & Training</option>
                    <option value="Retail">Retail & E-commerce</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Business profile description</label>
                  <textarea
                    rows={4}
                    placeholder="Provide a description of your services, location parameters, and core value proposition. The AI Manager references this when formulating campaigns."
                    value={businessDesc}
                    onChange={e => setBusinessDesc(e.target.value)}
                    className={cn(inputCls, 'resize-none')}
                  />
                </div>

                <button
                  onClick={handleSaveBrandAndBusiness}
                  className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition-all shadow-md shadow-brand-600/10"
                >
                  {brandSaved ? <><CheckCircle2 size={13} /> Saved</> : 'Save Business details'}
                </button>
              </div>
            )}

            {activeTab === 'brand' && (
              /* Brand Assets Section */
              <div className="glass rounded-2xl p-6 space-y-5 border border-white/5 shadow-lg">
                <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
                  <Image size={18} className="text-brand-400" />
                  <h2 className="text-base font-bold text-white">Brand Assets</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Primary brand color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={e => setBrandColor(e.target.value)}
                        className="w-10 h-10 bg-transparent rounded-lg border border-white/10 p-0.5 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={brandColor}
                        onChange={e => setBrandColor(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ad Copy theme style</label>
                    <select
                      value={brandStyle}
                      onChange={e => setBrandStyle(e.target.value)}
                      className="w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-all"
                    >
                      <option value="modern">Modern & Clean</option>
                      <option value="bold">Bold & Direct</option>
                      <option value="playful">Playful & Vibrant</option>
                      <option value="minimalist">Minimalist</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Brand Logo URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Provide a URL link to your logo. AI Manager uses this when drafting landing templates.</p>
                </div>

                <button
                  onClick={handleSaveBrandAndBusiness}
                  className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition-all shadow-md shadow-brand-600/10"
                >
                  {brandSaved ? <><CheckCircle2 size={13} /> Saved</> : 'Save Brand assets'}
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              /* Security / Password section */
              <div className="space-y-6">
                <div className="glass rounded-2xl p-6 space-y-4 border border-white/5 shadow-lg">
                  <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
                    <Lock size={18} className="text-brand-400" />
                    <h2 className="text-base font-bold text-white">Change password</h2>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">New password</label>
                    <input type="password" placeholder="Min. 8 characters" value={newPass} onChange={e => setNewPass(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirm new password</label>
                    <input type="password" placeholder="Re-enter new password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className={inputCls} />
                  </div>

                  {passError && <p className="text-xs text-red-400">{passError}</p>}

                  <button
                    onClick={handlePasswordChange}
                    disabled={changingPass}
                    className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition-all shadow-md"
                  >
                    {passSaved ? <><CheckCircle2 size={13} /> Saved</> : changingPass ? 'Updating...' : 'Update Password'}
                  </button>
                </div>

                {/* Account info ledger metrics */}
                <div className="glass rounded-2xl p-6 border border-white/5 shadow-lg">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                    <Bell size={18} className="text-brand-400" />
                    <h2 className="text-base font-bold text-white">Account information</h2>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Account role</span>
                      <span className="text-white capitalize">{profile?.role ?? 'client'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Member since</span>
                      <span className="text-white">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Supabase User ID</span>
                      <span className="text-slate-600 font-mono text-[10px] select-all">{profile?.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
