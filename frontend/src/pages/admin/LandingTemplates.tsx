import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileText, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  category: string
  industry: string
  version: string
  status: 'active' | 'draft'
  preview_url: string
}

const INITIAL_TEMPLATES: Template[] = [
  { id: 'tpl_health_1', name: 'Dental Care & Clinic Layout', category: 'health', industry: 'Healthcare', version: 'v1.2.0', status: 'active', preview_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=256&auto=format&fit=crop' },
  { id: 'tpl_fit_1', name: 'Gym Membership & Fitness Plan', category: 'fitness', industry: 'Sports & Gyms', version: 'v2.0.4', status: 'active', preview_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=256&auto=format&fit=crop' },
  { id: 'tpl_edu_1', name: 'Elite Academy Course Enrollment', category: 'education', industry: 'E-learning', version: 'v1.0.1', status: 'draft', preview_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=256&auto=format&fit=crop' }
]

export default function AdminLandingTemplates() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', industry: '', version: 'v1.0.0', preview_url: '' })


  const handleAddTemplate = () => {
    if (!form.name || !form.category || !form.industry) return
    const newTpl: Template = {
      id: `tpl_custom_${crypto.randomUUID().slice(0, 8)}`,
      name: form.name,
      category: form.category,
      industry: form.industry,
      version: form.version,
      status: 'draft',
      preview_url: form.preview_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=256&auto=format&fit=crop'
    }
    setTemplates([newTpl, ...templates])
    setShowAddModal(false)
    setForm({ name: '', category: '', industry: '', version: 'v1.0.0', preview_url: '' })
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleToggleStatus = (id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'active' ? 'draft' : 'active' } : t))
  }

  return (
    <>
      <Helmet><title>Landing Templates — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Landing Templates</h1>
            <p className="text-slate-400 text-sm mt-1">Manage and provision landing templates selection list for campaign creators.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg"
          >
            <Plus size={15} /> Upload Template
          </button>
        </div>

        <div className="glass-blue rounded-2xl p-4 flex gap-3 border border-violet-500/10">
          <FileText size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white text-sm font-medium mb-1">Templates Provisioning</p>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Templates uploaded here appear inside the Client Landing Pages library. Ensure pixels telemetry integration matches standard schema specs.
            </p>
          </div>
        </div>

        {/* Templates list table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden shadow-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 text-xs font-semibold uppercase">
                <th className="p-4">Template details</th>
                <th className="p-4">Category</th>
                <th className="p-4">Industry</th>
                <th className="p-4">Version</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {templates.map(tpl => (
                <tr key={tpl.id} className="hover:bg-white/[0.01] transition-all">
                  <td className="p-4 flex items-center gap-3">
                    <img src={tpl.preview_url} alt="tpl preview" className="w-12 h-8 object-cover rounded-lg border border-white/10" />
                    <div>
                      <span className="text-white font-semibold block">{tpl.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold uppercase">{tpl.id}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300 capitalize">{tpl.category}</td>
                  <td className="p-4 text-slate-300">{tpl.industry}</td>
                  <td className="p-4 font-mono text-slate-400 text-xs">{tpl.version}</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(tpl.id)}
                      className={cn(
                        'text-[10px] px-2.5 py-0.5 border rounded-full font-bold uppercase tracking-wider transition-all',
                        tpl.status === 'active'
                          ? 'bg-green-500/10 border-green-500/20 text-green-400'
                          : 'bg-slate-500/10 border-white/10 text-slate-400'
                      )}
                    >
                      {tpl.status}
                    </button>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleDelete(tpl.id)}
                      className="p-1.5 border border-red-500/10 hover:bg-red-500/10 text-red-400 rounded-lg transition-all"
                      title="Delete Template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative glass rounded-3xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
              <h2 className="text-base font-bold text-white">Upload Landing Template</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white border border-white/10 hover:border-white/20 p-1 rounded-xl"><X size={16} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Template Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dental Care Premium Clinic"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
                  >
                    <option value="">Select category</option>
                    <option value="health">Health</option>
                    <option value="fitness">Fitness</option>
                    <option value="education">Education</option>
                    <option value="finance">Finance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Industry *</label>
                  <input
                    type="text"
                    placeholder="e.g. Healthcare"
                    value={form.industry}
                    onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Version tag</label>
                <input
                  type="text"
                  placeholder="v1.0.0"
                  value={form.version}
                  onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Preview Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={form.preview_url}
                  onChange={e => setForm(f => ({ ...f, preview_url: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTemplate}
                  disabled={!form.name || !form.category || !form.industry}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all"
                >
                  Publish Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
