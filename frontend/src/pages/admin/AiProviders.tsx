import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Cpu, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'

interface AIProvider {
  id: string
  name: string
  key_configured: boolean
  key_masked: string
  model: string
  fallback_model: string
  max_tokens: number
  temperature: number
  active: boolean
  last_test_status: 'success' | 'failed' | null
  last_test_message: string | null
}

// Providers an admin can configure. Existing rows come back from the API;
// any of these not yet saved are offered as blank starting points so the
// page still lists all 5 even before first save.
const KNOWN_PROVIDERS: Array<{ id: string; name: string }> = [
  { id: 'openai', name: 'OpenAI (GPT-4o, GPT-3.5)' },
  { id: 'claude', name: 'Anthropic Claude (Sonnet, Haiku)' },
  { id: 'gemini', name: 'Google Gemini (Flash, Pro)' },
  { id: 'openrouter', name: 'OpenRouter Gateway' },
  { id: 'ollama', name: 'Ollama Local Integration' },
]

export default function AdminAiProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [drafts, setDrafts] = useState<Record<string, Partial<AIProvider> & { api_key?: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await adminGet<AIProvider[]>('/ai-providers')
      const byId = new Map(rows.map(r => [r.id, r]))
      const merged = KNOWN_PROVIDERS.map(known => byId.get(known.id) ?? {
        id: known.id,
        name: known.name,
        key_configured: false,
        key_masked: '',
        model: '',
        fallback_model: '',
        max_tokens: 4096,
        temperature: 0.3,
        active: known.id !== 'ollama',
        last_test_status: null,
        last_test_message: null,
      })
      setProviders(merged)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load AI providers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const field = (p: AIProvider, key: keyof AIProvider) => drafts[p.id]?.[key] ?? p[key]

  const handleUpdateField = (id: string, fieldName: string, value: string | number | boolean) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [fieldName]: value } }))
  }

  const handleSave = async (p: AIProvider) => {
    setSaving(p.id)
    setError(null)
    try {
      const draft = drafts[p.id] ?? {}
      const updated = await adminSend<AIProvider>(`/ai-providers/${p.id}`, 'PUT', {
        name: p.name,
        api_key: draft.api_key, // undefined = keep existing key unchanged
        model: draft.model ?? p.model,
        fallback_model: draft.fallback_model ?? p.fallback_model,
        max_tokens: draft.max_tokens ?? p.max_tokens,
        temperature: draft.temperature ?? p.temperature,
        active: draft.active ?? p.active,
      })
      setProviders(prev => prev.map(row => (row.id === p.id ? updated : row)))
      setDrafts(prev => ({ ...prev, [p.id]: {} }))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : `Failed to save ${p.id}.`)
    } finally {
      setSaving(null)
    }
  }

  const handleTestConnection = async (id: string) => {
    setTesting(id)
    setError(null)
    try {
      const updated = await adminSend<AIProvider>(`/ai-providers/${id}/test`, 'POST')
      setProviders(prev => prev.map(row => (row.id === id ? updated : row)))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : `Connection test failed for ${id}.`)
    } finally {
      setTesting(null)
    }
  }

  return (
    <>
      <Helmet><title>AI Providers Config — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI Model Providers</h1>
          <p className="text-slate-500 text-sm mt-1">Configure foundational LLM endpoints, routing keys, model tags, fallback limits, and temperatures.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">Loading providers…</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {providers.map(prov => (
              <div key={prov.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                        <Cpu size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{prov.name}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase mt-0.5 px-2 py-0.5 rounded-full border ${field(prov, 'active') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {field(prov, 'active') ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${prov.last_test_status === 'success' ? 'text-emerald-600' : prov.last_test_status === 'failed' ? 'text-red-500' : 'text-slate-400'}`}>
                      {prov.last_test_status === 'success' ? <CheckCircle2 size={14} /> : prov.last_test_status === 'failed' ? <XCircle size={14} /> : null}
                      {prov.last_test_status === 'success' ? 'Connected' : prov.last_test_status === 'failed' ? 'Disconnected' : 'Not tested yet'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">API Key / Secret</label>
                      <input
                        type="password"
                        placeholder={prov.key_configured ? prov.key_masked : 'Not configured — enter a key'}
                        value={drafts[prov.id]?.api_key ?? ''}
                        onChange={e => handleUpdateField(prov.id, 'api_key', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Active Model Tag</label>
                      <input
                        type="text"
                        value={String(field(prov, 'model') ?? '')}
                        onChange={e => handleUpdateField(prov.id, 'model', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fallback Model Tag</label>
                      <input
                        type="text"
                        value={String(field(prov, 'fallback_model') ?? '')}
                        onChange={e => handleUpdateField(prov.id, 'fallback_model', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Max Tokens</label>
                      <input
                        type="number"
                        value={Number(field(prov, 'max_tokens') ?? 0)}
                        onChange={e => handleUpdateField(prov.id, 'max_tokens', parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Temperature ({Number(field(prov, 'temperature') ?? 0)})</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={Number(field(prov, 'temperature') ?? 0)}
                        onChange={e => handleUpdateField(prov.id, 'temperature', parseFloat(e.target.value))}
                        className="w-full h-8 cursor-pointer"
                      />
                    </div>
                  </div>
                  {prov.last_test_message && (
                    <p className="text-[11px] text-slate-400">{prov.last_test_message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 min-w-[140px] self-end lg:self-center">
                  <button
                    onClick={() => handleSave(prov)}
                    disabled={saving === prov.id}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {saving === prov.id ? 'Saving...' : 'Save Settings'}
                  </button>
                  <button
                    onClick={() => handleTestConnection(prov.id)}
                    disabled={testing === prov.id}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {testing === prov.id ? <RefreshCw size={12} className="animate-spin" /> : 'Test Connection'}
                  </button>
                  <button
                    onClick={() => handleUpdateField(prov.id, 'active', !field(prov, 'active'))}
                    className={`w-full py-2 border text-xs font-semibold rounded-xl transition-all ${field(prov, 'active') ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {field(prov, 'active') ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
