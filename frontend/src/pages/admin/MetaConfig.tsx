import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Save, Info, RefreshCw } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'

interface MetaConfigForm {
  app_id: string
  app_secret: string
  app_secret_configured: boolean
  app_secret_masked: string
  verify_token: string
  webhook_secret: string
  webhook_secret_configured: boolean
  webhook_secret_masked: string
  business_manager_id: string
  default_pixel_id: string
}

interface MetaConfigApiResponse {
  app_id: string
  app_secret_configured: boolean
  app_secret_masked: string
  verify_token: string
  webhook_secret_configured: boolean
  webhook_secret_masked: string
  business_manager_id: string
  default_pixel_id: string
}

const EMPTY: MetaConfigForm = {
  app_id: '', app_secret: '', app_secret_configured: false, app_secret_masked: '',
  verify_token: '', webhook_secret: '', webhook_secret_configured: false, webhook_secret_masked: '',
  business_manager_id: '', default_pixel_id: '',
}

export default function AdminMetaConfig() {
  const [configForm, setConfigForm] = useState<MetaConfigForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [stats, setStats] = useState<{ businesses: number; adAccounts: number; pixels: number } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const remote = await adminGet<MetaConfigApiResponse>('/meta-config')
      setConfigForm({
        app_id: remote.app_id ?? '',
        app_secret: '',
        app_secret_configured: remote.app_secret_configured ?? false,
        app_secret_masked: remote.app_secret_masked ?? '',
        verify_token: remote.verify_token ?? '',
        webhook_secret: '',
        webhook_secret_configured: remote.webhook_secret_configured ?? false,
        webhook_secret_masked: remote.webhook_secret_masked ?? '',
        business_manager_id: remote.business_manager_id ?? '',
        default_pixel_id: remote.default_pixel_id ?? '',
      })
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load Meta configuration.')
    } finally {
      setLoading(false)
    }
  }

  // Real counts (not hardcoded) from the same meta_accounts table the
  // per-user Meta Accounts admin page (Meta.tsx) reads.
  const loadStats = async () => {
    const { data } = await supabase.from('meta_accounts').select('business_id, ad_account_id, pixel_id')
    if (data) {
      setStats({
        businesses: new Set(data.map(r => r.business_id)).size,
        adAccounts: new Set(data.filter(r => r.ad_account_id).map(r => r.ad_account_id)).size,
        pixels: new Set(data.filter(r => r.pixel_id).map(r => r.pixel_id)).size,
      })
    }
  }

  useEffect(() => { load(); loadStats() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const remote = await adminSend<MetaConfigApiResponse>('/meta-config', 'PUT', {
        app_id: configForm.app_id,
        app_secret: configForm.app_secret || undefined,
        verify_token: configForm.verify_token,
        webhook_secret: configForm.webhook_secret || undefined,
        business_manager_id: configForm.business_manager_id,
        default_pixel_id: configForm.default_pixel_id,
      })
      setConfigForm(prev => ({
        ...prev,
        app_secret: '',
        webhook_secret: '',
        app_secret_configured: remote.app_secret_configured,
        app_secret_masked: remote.app_secret_masked,
        webhook_secret_configured: remote.webhook_secret_configured,
        webhook_secret_masked: remote.webhook_secret_masked,
      }))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to save Meta configuration.')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const health = await adminGet<{ checks: Array<{ name: string; status: string; detail: string }> }>('/system-health')
      const check = health.checks.find(c => c.name === 'Meta Marketing API')
      setTestResult(check ? check.detail : 'Could not find a Meta Marketing API health check result.')
    } catch (e) {
      setTestResult(e instanceof AdminApiError ? e.message : 'Test failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Helmet><title>Meta Configurations — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Meta SDK & Credentials</h1>
          <p className="text-slate-500 text-sm mt-1">Configure global application parameters for OAuth authorization login flow, webhook events, and default pixel tags.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main config form */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="text-sm text-slate-400">Loading Meta configuration…</div>
            ) : (
              <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Meta App ID *</label>
                    <input
                      type="text"
                      required
                      value={configForm.app_id}
                      onChange={e => setConfigForm(prev => ({ ...prev, app_id: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Meta App Secret {configForm.app_secret_configured ? '' : '*'}</label>
                    <input
                      type="password"
                      required={!configForm.app_secret_configured}
                      placeholder={configForm.app_secret_configured ? configForm.app_secret_masked : 'Enter app secret'}
                      value={configForm.app_secret}
                      onChange={e => setConfigForm(prev => ({ ...prev, app_secret: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Webhook Verify Token *</label>
                    <input
                      type="text"
                      required
                      value={configForm.verify_token}
                      onChange={e => setConfigForm(prev => ({ ...prev, verify_token: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Webhook App Secret</label>
                    <input
                      type="password"
                      placeholder={configForm.webhook_secret_configured ? configForm.webhook_secret_masked : 'Enter webhook secret'}
                      value={configForm.webhook_secret}
                      onChange={e => setConfigForm(prev => ({ ...prev, webhook_secret: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Business Manager ID</label>
                    <input
                      type="text"
                      value={configForm.business_manager_id}
                      onChange={e => setConfigForm(prev => ({ ...prev, business_manager_id: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Default Fallback Pixel ID</label>
                    <input
                      type="text"
                      value={configForm.default_pixel_id}
                      onChange={e => setConfigForm(prev => ({ ...prev, default_pixel_id: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-2.5">
                  <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Verify Webhook requests by adding this <strong>Verify Token</strong> inside your Meta App Developer Portal under the Webhooks configuration panel. Ensure leadgen updates are subscribed.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    {saving ? 'Saving Configurations...' : 'Save Meta Configuration'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Integration Status Panel */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Connection Status</h3>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">App Configured</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${configForm.app_id && configForm.app_secret_configured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {configForm.app_id && configForm.app_secret_configured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Connected Businesses</span>
                  <span className="text-slate-800 font-semibold">{stats ? `${stats.businesses} businesses` : '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Connected Ad Accounts</span>
                  <span className="text-slate-800 font-semibold">{stats ? `${stats.adAccounts} ad accounts` : '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Connected Pixels</span>
                  <span className="text-slate-800 font-semibold">{stats ? `${stats.pixels} pixels` : '—'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
                  {testing ? 'Testing connection...' : 'Test Connection'}
                </button>
              </div>

              {testResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-700 leading-relaxed font-semibold">
                  {testResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
