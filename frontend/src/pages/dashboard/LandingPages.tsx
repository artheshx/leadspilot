import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileText, ExternalLink, Eye, Users, Clock, CheckCircle2, Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'

type LPStatus = 'draft' | 'live' | 'paused'
type LPCategory = 'all' | 'health' | 'fitness' | 'education' | 'finance'

interface LandingPage {
  id: string
  name: string
  url: string | null
  status: LPStatus
  views: number
  submissions: number
  campaign_id: string | null
  campaign_name?: string | null
  created_at: string
}

interface Template {
  id: string
  name: string
  category: LPCategory
  industry: string
  preview_url: string
  is_favorite: boolean
}

type LandingPageRow = LandingPage & {
  campaigns?: {
    name: string | null
  } | null
}

const STATUS_CONFIG: Record<LPStatus, { label: string; color: string }> = {
  draft: { label: 'In progress', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  live: { label: 'Live', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  paused: { label: 'Paused', color: 'text-slate-400 border-white/15 bg-white/5' },
}

const STATIC_TEMPLATES: Template[] = [
  { id: 'tpl_health_1', name: 'Dental Care & Clinic Layout', category: 'health', industry: 'Healthcare', preview_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=600&auto=format&fit=crop', is_favorite: true },
  { id: 'tpl_fit_1', name: 'Gym Membership & Fitness Plan', category: 'fitness', industry: 'Sports & Gyms', preview_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop', is_favorite: true },
  { id: 'tpl_edu_1', name: 'Elite Academy Course Enrollment', category: 'education', industry: 'E-learning', preview_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=600&auto=format&fit=crop', is_favorite: false },
  { id: 'tpl_fin_1', name: 'Wealth & Stock Investment Guide', category: 'finance', industry: 'Investment', preview_url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=600&auto=format&fit=crop', is_favorite: false }
]

export default function LandingPages() {
  const { user } = useAuth()
  const [pages, setPages] = useState<LandingPage[]>([])
  const [templates, setTemplates] = useState<Template[]>(STATIC_TEMPLATES)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<LPCategory>('all')
  const [showTemplateModal, setShowTemplateModal] = useState<Template | null>(null)
  const [selectedSubTab, setSelectedSubTab] = useState<'my_pages' | 'templates'>('my_pages')

  useEffect(() => {
    if (!user) return
    async function fetch() {
      const { data } = await supabase
        .from('landing_pages')
        .select('*, campaigns(name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

      setPages(((data ?? []) as LandingPageRow[]).map(p => ({
        ...p,
        campaign_name: p.campaigns?.name ?? null,
      })))
      setLoading(false)
    }
    fetch()
  }, [user])

  const toggleFavorite = (tplId: string) => {
    setTemplates(prev => prev.map(t => t.id === tplId ? { ...t, is_favorite: !t.is_favorite } : t))
  }

  const handleUseTemplate = (template: Template) => {
    setShowTemplateModal(null)
    alert(`Applied template recommendation "${template.name}". I've copied this choice to the active campaign brief context!`)
  }

  // Filter templates list
  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter(t => t.category === categoryFilter)

  return (
    <>
      <Helmet><title>Landing Page Manager — LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Landing Pages</h1>
            <p className="text-slate-400 text-sm mt-1">Manage live campaign pages or pick recommended landing page templates.</p>
          </div>
        </div>

        {/* Section switcher subtabs */}
        <div className="flex border-b border-white/5 pb-2.5 gap-6">
          <button
            onClick={() => setSelectedSubTab('my_pages')}
            className={cn(
              'text-sm font-semibold transition-all border-b-2 pb-2',
              selectedSubTab === 'my_pages'
                ? 'border-brand-500 text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            My Landing Pages ({pages.length})
          </button>
          <button
            onClick={() => setSelectedSubTab('templates')}
            className={cn(
              'text-sm font-semibold transition-all border-b-2 pb-2',
              selectedSubTab === 'templates'
                ? 'border-brand-500 text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            Template Library
          </button>
        </div>

        {selectedSubTab === 'my_pages' ? (
          /* Subtab 1: active landing pages list */
          <div className="space-y-6">
            {/* Info notice banner */}
            <div className="glass-blue rounded-2xl p-4 flex gap-3 border border-brand-500/10">
              <div className="w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={15} className="text-brand-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium mb-0.5">High converting campaign landing templates</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  These pages are managed and hosted directly by LeadPilot. Every submission is piped straight to your Leads tab and triggers conversion events on your Meta Pixel.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-44 glass rounded-2xl animate-pulse" />)}
              </div>
            ) : pages.length === 0 ? (
              <div className="glass rounded-2xl p-16 text-center border border-white/5">
                <FileText size={36} className="text-slate-700 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No landing pages yet</p>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Landing pages appear here once the AI chooses a template and publishes a campaign draft.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {pages.map(page => {
                  const cfg = STATUS_CONFIG[page.status] || STATUS_CONFIG.draft
                  const convRate = page.views > 0 ? ((page.submissions / page.views) * 100).toFixed(1) : '0.0'
                  return (
                    <div key={page.id} className="glass rounded-2xl p-5 flex flex-col justify-between gap-4 border border-white/5 hover:border-white/10 transition-all">
                      <div className="space-y-4">
                        {/* Header info */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-brand-600/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-brand-500/10">
                              <FileText size={16} className="text-brand-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-bold text-sm truncate">{page.name}</p>
                              {page.campaign_name && (
                                <p className="text-slate-500 text-xs truncate">→ {page.campaign_name}</p>
                              )}
                            </div>
                          </div>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase', cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>

                        {/* Conversions grid */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Views', value: page.views.toLocaleString('en-IN'), icon: Eye },
                            { label: 'Leads', value: page.submissions.toLocaleString('en-IN'), icon: Users },
                            { label: 'Conv. rate', value: `${convRate}%`, icon: CheckCircle2 },
                          ].map(stat => (
                            <div key={stat.label} className="bg-dark-800/40 rounded-xl p-2.5 text-center">
                              <p className="text-white font-bold text-base">{stat.value}</p>
                              <p className="text-slate-600 text-[10px] uppercase font-semibold mt-0.5">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer date & url link */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                          <Clock size={11} />
                          {new Date(page.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        {page.url && (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            Live Preview <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Subtab 2: recommended Template Library */
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-xs font-semibold text-slate-400">Filter Templates by Category</span>
              <div className="flex gap-1">
                {(['all', 'health', 'fitness', 'education', 'finance'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg transition-all capitalize',
                      categoryFilter === cat
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {filteredTemplates.map(tpl => (
                <div key={tpl.id} className="glass rounded-2xl overflow-hidden border border-white/5 group flex flex-col justify-between shadow-lg">
                  <div className="aspect-video bg-dark-800 relative overflow-hidden flex items-center justify-center">
                    <img
                      src={tpl.preview_url}
                      alt={tpl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />

                    {/* Badge */}
                    <span className="absolute top-3 left-3 bg-dark-900/85 border border-white/10 text-slate-300 text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold">
                      {tpl.industry}
                    </span>

                    {/* Heart button */}
                    <button
                      onClick={() => toggleFavorite(tpl.id)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-dark-900/85 border border-white/10 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Heart size={14} fill={tpl.is_favorite ? 'currentColor' : 'none'} className={tpl.is_favorite ? 'text-red-500' : ''} />
                    </button>

                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => setShowTemplateModal(tpl)}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <Eye size={13} />
                        View Specs
                      </button>
                    </div>
                  </div>

                  <div className="p-4 flex items-center justify-between border-t border-white/5 bg-white/[0.01]">
                    <div>
                      <p className="text-white font-bold text-sm truncate">{tpl.name}</p>
                      <p className="text-slate-500 text-[10px] uppercase font-semibold font-mono mt-0.5">{tpl.id}</p>
                    </div>
                    <button
                      onClick={() => handleUseTemplate(tpl)}
                      className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 font-semibold px-3 py-2 rounded-xl transition-all"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Template View Detail Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTemplateModal(null)} />
          <div className="relative glass rounded-3xl overflow-hidden border border-white/10 max-w-xl w-full shadow-2xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-dark-900/80">
              <div>
                <h3 className="font-bold text-white text-sm">{showTemplateModal.name}</h3>
                <span className="text-[10px] px-2 py-0.5 bg-brand-600/10 border border-brand-500/20 text-brand-400 rounded-full font-medium uppercase mt-1 inline-block">
                  {showTemplateModal.industry} Template
                </span>
              </div>
              <button
                onClick={() => setShowTemplateModal(null)}
                className="text-slate-400 hover:text-white border border-white/10 hover:border-white/20 p-2 rounded-xl transition-all"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="aspect-video bg-dark-800 rounded-xl overflow-hidden border border-white/5">
                <img src={showTemplateModal.preview_url} alt="Template detail" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Features included:</h4>
                <ul className="grid grid-cols-2 gap-2 text-xs text-slate-400 list-disc list-inside">
                  <li>Conversion Telemetry Ready</li>
                  <li>Responsive Mobile Layout</li>
                  <li>Meta Pixel integration</li>
                  <li>Fast CDN delivery</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-dark-900/80 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(null)}
                className="px-4 py-2.5 border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUseTemplate(showTemplateModal)}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-all"
              >
                Select & Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
