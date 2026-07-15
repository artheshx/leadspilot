import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Code, Save } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'

interface PromptTemplate {
  id: string
  name: string
  description: string
  content: string
}

// Sensible defaults, seeded into the backend on first load if no prompts
// have been saved yet (so the page isn't empty on a fresh install), then
// never re-seeded once real rows exist.
const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'analyzer',
    name: 'Business Analyzer Prompt',
    description: 'Instructs model on parsing user requirements, business goals, and sector context.',
    content: 'You are a lead generation auditing employee. Analyze the user business name, target metrics, location, and competitor profiles. Outline primary lead vectors.'
  },
  {
    id: 'strategy',
    name: 'Strategy Designer Prompt',
    description: 'Controls how campaign target strategies and budget recommendations are designed.',
    content: 'Construct a detailed target strategy checklist for a Meta Ads campaign. Specify custom interests target groupings, placement specifications, and estimate leads ranges.'
  },
  {
    id: 'creative',
    name: 'Creative Generator Prompt',
    description: 'Instructs the copywriting and visual asset suggestions generators.',
    content: 'Generate primary ad texts, headline pitches, call-to-action hooks, and prompt coordinates for image placeholders. Maintain professional copy tones.'
  },
  {
    id: 'landing',
    name: 'Landing Page Selector Prompt',
    description: 'Drives landing page template matching and JSON copy updates.',
    content: 'Select the optimal landing page template index matching the campaign objective. Output structured JSON replacements for headings and signup cards.'
  },
  {
    id: 'optimization',
    name: 'Optimization Engine Prompt',
    description: 'Formulates ongoing campaign recommendations (pause, resume, adjust budget).',
    content: 'Analyze real-time campaign CTR, CPM, and CPL metrics. Formulate pending recommendations (e.g. increase daily limits, pause lower performing ad groups).'
  },
  {
    id: 'compliance',
    name: 'Compliance Audit Prompt',
    description: 'Controls verification checks for Meta advertising policy guidelines.',
    content: 'Audit creative texts and headers. Flags references containing personal attributes, discrimination keywords, or unverified claims. Output clear safety status.'
  }
]

export default function AdminAiPrompts() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      let rows = await adminGet<PromptTemplate[]>('/ai-prompts')
      if (rows.length === 0) {
        // First run — seed the known prompt templates so the page isn't empty.
        for (const p of DEFAULT_PROMPTS) {
          await adminSend(`/ai-prompts/${p.id}`, 'PUT', { name: p.name, description: p.description, content: p.content })
        }
        rows = await adminGet<PromptTemplate[]>('/ai-prompts')
      }
      setPrompts(rows)
      setActiveId(rows[0]?.id ?? null)
      setDraftContent(rows[0]?.content ?? '')
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load prompt templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activePrompt = prompts.find(p => p.id === activeId) ?? null

  const handleSelect = (p: PromptTemplate) => {
    setActiveId(p.id)
    setDraftContent(p.content)
  }

  const handleSave = async () => {
    if (!activePrompt) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminSend<PromptTemplate>(`/ai-prompts/${activePrompt.id}`, 'PUT', {
        name: activePrompt.name,
        description: activePrompt.description,
        content: draftContent,
      })
      setPrompts(prev => prev.map(p => (p.id === updated.id ? updated : p)))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to save prompt template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Helmet><title>System Prompts Settings — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Prompt Templates Manager</h1>
          <p className="text-slate-500 text-sm mt-1">Configure foundational system instructions that control target strategy creation, copywriting compliance, and optimizations.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading || !activePrompt ? (
          <div className="text-sm text-slate-400">{loading ? 'Loading prompt templates…' : 'No prompt templates yet.'}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Prompts list selector */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block px-2 mb-2">Prompt Templates</span>
              {prompts.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${activePrompt.id === p.id ? 'bg-blue-50/50 text-blue-600 font-bold border-blue-100/50' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="block">{p.name}</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-1 truncate">{p.description}</span>
                </button>
              ))}
            </div>

            {/* Prompt editor panel */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{activePrompt.name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{activePrompt.description}</p>
                </div>
                <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Code size={15} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System Instructions</label>
                <textarea
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  rows={10}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none font-mono leading-relaxed"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {saving ? 'Saving System Instructions...' : 'Save Instructions'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
