import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Save, Info } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'

interface WhatsAppForm {
  access_token: string
  access_token_configured: boolean
  access_token_masked: string
  phone_number_id: string
  business_account_id: string
  verify_token: string
}

interface WhatsAppApiResponse {
  access_token_configured: boolean
  access_token_masked: string
  phone_number_id: string
  business_account_id: string
  verify_token: string
}

const EMPTY: WhatsAppForm = {
  access_token: '', access_token_configured: false, access_token_masked: '',
  phone_number_id: '', business_account_id: '', verify_token: '',
}

export default function AdminWhatsApp() {
  const [configForm, setConfigForm] = useState<WhatsAppForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const remote = await adminGet<WhatsAppApiResponse>('/whatsapp-config')
      setConfigForm({
        access_token: '',
        access_token_configured: remote.access_token_configured ?? false,
        access_token_masked: remote.access_token_masked ?? '',
        phone_number_id: remote.phone_number_id ?? '',
        business_account_id: remote.business_account_id ?? '',
        verify_token: remote.verify_token ?? '',
      })
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load WhatsApp configuration.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const remote = await adminSend<WhatsAppApiResponse>('/whatsapp-config', 'PUT', {
        access_token: configForm.access_token || undefined,
        phone_number_id: configForm.phone_number_id,
        business_account_id: configForm.business_account_id,
        verify_token: configForm.verify_token,
      })
      setConfigForm(prev => ({
        ...prev,
        access_token: '',
        access_token_configured: remote.access_token_configured,
        access_token_masked: remote.access_token_masked,
      }))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to save WhatsApp configuration.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Helmet><title>WhatsApp Cloud Config — LeadPilot Admin</title></Helmet>

      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-slate-800">WhatsApp Cloud API</h1>
          <p className="text-slate-500 text-sm mt-1">Configure systemic WhatsApp credentials for trigger updates, automated alerts, and conversational prompts.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">Loading WhatsApp configuration…</div>
        ) : (
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Permanent Access Token {configForm.access_token_configured ? '' : '*'}
                </label>
                <textarea
                  required={!configForm.access_token_configured}
                  rows={3}
                  placeholder={configForm.access_token_configured ? configForm.access_token_masked : 'Enter permanent access token'}
                  value={configForm.access_token}
                  onChange={e => setConfigForm(prev => ({ ...prev, access_token: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number ID *</label>
                  <input
                    type="text"
                    required
                    value={configForm.phone_number_id}
                    onChange={e => setConfigForm(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Business Account ID *</label>
                  <input
                    type="text"
                    required
                    value={configForm.business_account_id}
                    onChange={e => setConfigForm(prev => ({ ...prev, business_account_id: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
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
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-2.5">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-slate-500 text-xs leading-relaxed">
                Use this verify token inside Meta Developer center under WhatsApp Configuration Webhooks. Make sure to subscribe to <strong>messages</strong> events to trigger conversational strategy drafts updates.
                Saving here stores credentials encrypted; no message-sending code in the AI Manager currently calls out to WhatsApp — this page only manages the configuration itself.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Save size={14} />
                {saving ? 'Saving configurations...' : 'Save WhatsApp Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
