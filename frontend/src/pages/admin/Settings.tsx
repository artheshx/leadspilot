import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, Sliders, Shield, Database, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

type SettingsTab = 'keys' | 'notifications' | 'branding'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('keys')
  const [saved, setSaved] = useState(false)

  // API Config states
  const [metaAppId, setMetaAppId] = useState('123456789012345')
  const [metaSecret, setMetaSecret] = useState('********************************')
  const [openRouterKey, setOpenRouterKey] = useState('sk-or-v1-********************************')
  const [supabaseUrl, setSupabaseUrl] = useState('https://lp-proj-uuid.supabase.co')

  // Notification / WhatsApp / SMTP states
  const [smtpServer, setSmtpServer] = useState('smtp.sendgrid.net')
  const [smtpPort, setSmtpPort] = useState('587')
  const [waEndpoint, setWaEndpoint] = useState('https://graph.facebook.com/v19.0/phone-id/messages')

  // White label branding states
  const [portalName, setPortalName] = useState('LeadPilot')
  const [brandColor, setBrandColor] = useState('#7c3aed')

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const inputCls = "w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold"

  return (
    <>
      <Helmet><title>System settings — Admin LeadPilot</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">System Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Configure global API integrations, webhook connections, and infrastructure settings.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-white/5 pb-2.5 gap-6">
          {[
            { id: 'keys', label: 'API Keys & Secrets', icon: Database },
            { id: 'notifications', label: 'Gateway Gateways', icon: Send },
            { id: 'branding', label: 'Portal Branding', icon: Sliders },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={cn(
                'text-sm font-semibold transition-all border-b-2 pb-2 flex items-center gap-2',
                activeTab === tab.id
                  ? 'border-violet-500 text-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'keys' && (
          <div className="glass rounded-2xl p-6 space-y-5 border border-white/5 shadow-lg">
            <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
              <Shield size={18} className="text-violet-400" />
              <h2 className="text-base font-bold text-white">Integrations Credentials</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Facebook Graph App ID</label>
                <input type="text" value={metaAppId} onChange={e => setMetaAppId(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Facebook App Secret</label>
                <input type="password" value={metaSecret} onChange={e => setMetaSecret(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">OpenRouter API Key (AI Engine Model gateway)</label>
              <input type="password" value={openRouterKey} onChange={e => setOpenRouterKey(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Supabase Backend REST URL</label>
              <input type="url" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="glass rounded-2xl p-6 space-y-5 border border-white/5 shadow-lg">
            <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
              <Send size={18} className="text-violet-400" />
              <h2 className="text-base font-bold text-white">SMTP Mailer & WhatsApp Gateways</h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SMTP Hostname Server</label>
                <input type="text" value={smtpServer} onChange={e => setSmtpServer(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                <input type="text" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Cloud API endpoint</label>
              <input type="url" value={waEndpoint} onChange={e => setWaEndpoint(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="glass rounded-2xl p-6 space-y-5 border border-white/5 shadow-lg">
            <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/5">
              <Sliders size={18} className="text-violet-400" />
              <h2 className="text-base font-bold text-white">Portal Whitelabel customization</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Portal Platform Name</label>
                <input type="text" value={portalName} onChange={e => setPortalName(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Branding Accent Color</label>
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
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md"
        >
          {saved ? <><CheckCircle2 size={13} /> Settings saved</> : 'Save system configurations'}
        </button>
      </div>
    </>
  )
}
