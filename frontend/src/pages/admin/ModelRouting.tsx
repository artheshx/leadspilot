import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowLeftRight, Save, Info } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'

interface RoutingRule {
  id: string
  task_label: string
  description: string
  provider_id: string | null
  fallback_provider_id: string | null
}

interface ProviderOption { id: string; name: string }

// Same 5 tasks the workflow already performs (business analysis, strategy,
// creative, landing template selection, optimization) — seeded on first
// load, same pattern as AiPrompts.tsx.
const DEFAULT_RULES: RoutingRule[] = [
  { id: 'analysis', task_label: 'Business Analysis & Audit', description: 'Parses business context, targets, and competitor details.', provider_id: 'gemini', fallback_provider_id: 'openrouter' },
  { id: 'strategy', task_label: 'Strategy Formulation', description: 'Designs target tags and campaign budget structures.', provider_id: 'claude', fallback_provider_id: 'gemini' },
  { id: 'creative', task_label: 'Creative Copy & Copywriting', description: 'Drafts primary text, headlines, and visuals prompts.', provider_id: 'openai', fallback_provider_id: 'claude' },
  { id: 'landing', task_label: 'Landing Template Selection', description: 'Selects design templates and updates text copy JSON.', provider_id: 'gemini', fallback_provider_id: 'openai' },
  { id: 'optimization', task_label: 'Optimizations & Recommendations', description: 'Analyzes live CTR / CPL and prepares recommendations.', provider_id: 'claude', fallback_provider_id: 'openai' },
]

const FALLBACK_PROVIDER_OPTIONS: ProviderOption[] = [
  { id: 'openai', name: 'OpenAI (GPT-4o, GPT-3.5)' },
  { id: 'claude', name: 'Anthropic Claude (Sonnet, Haiku)' },
  { id: 'gemini', name: 'Google Gemini (Flash, Pro)' },
  { id: 'openrouter', name: 'OpenRouter Gateway' },
  { id: 'ollama', name: 'Ollama Local Integration' },
]

export default function AdminModelRouting() {
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [providers, setProviders] = useState<ProviderOption[]>(FALLBACK_PROVIDER_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [providerRows, ruleRows] = await Promise.all([
        adminGet<Array<{ id: string; name: string }>>('/ai-providers'),
        adminGet<RoutingRule[]>('/model-routing'),
      ])
      if (providerRows.length > 0) setProviders(providerRows)

      let effectiveRules = ruleRows
      if (ruleRows.length === 0) {
        for (const r of DEFAULT_RULES) {
          await adminSend(`/model-routing/${r.id}`, 'PUT', {
            task_label: r.task_label, description: r.description,
            provider_id: r.provider_id, fallback_provider_id: r.fallback_provider_id,
          })
        }
        effectiveRules = await adminGet<RoutingRule[]>('/model-routing')
      }
      setRules(effectiveRules)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load model routing rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpdateRule = (id: string, field: 'provider_id' | 'fallback_provider_id', value: string) => {
    setRules(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const saved = await Promise.all(
        rules.map(r =>
          adminSend<RoutingRule>(`/model-routing/${r.id}`, 'PUT', {
            task_label: r.task_label,
            description: r.description,
            provider_id: r.provider_id,
            fallback_provider_id: r.fallback_provider_id,
          })
        )
      )
      setRules(saved)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to save routing rules.')
    } finally {
      setSaving(false)
    }
  }


  return (
    <>
      <Helmet><title>Model Routing Rules — LeadPilot Admin</title></Helmet>

      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-slate-800">LLM Routing Control</h1>
          <p className="text-slate-500 text-sm mt-1">Route specific workflow steps to the optimal LLM endpoints to balance response speed, costs, and quality.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workflow Routing Map</span>
            <span className="text-[10px] text-slate-400 font-semibold">{rules.length} Tasks Managed</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading routing rules…</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map(rule => (
                <div key={rule.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800">{rule.task_label}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">{rule.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 flex-shrink-0">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Primary Route</label>
                      <select
                        value={rule.provider_id ?? ''}
                        onChange={e => handleUpdateRule(rule.id, 'provider_id', e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="">— Not set —</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center pt-4 text-slate-300">
                      <ArrowLeftRight size={14} />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Fallback Route</label>
                      <select
                        value={rule.fallback_provider_id ?? ''}
                        onChange={e => handleUpdateRule(rule.id, 'fallback_provider_id', e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="">— Not set —</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info size={14} className="text-blue-600 flex-shrink-0" />
              <span>Configure the provider's actual API key on the AI Providers page — routing here only chooses which configured provider handles each task.</span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Save size={13} />
              {saving ? 'Updating Rules...' : 'Save Routing Map'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
