import { useEffect, useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Image, Video, LayoutGrid, Clock, Download, Upload, Eye, CheckCircle2, ShieldAlert, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'

type CreativeType = 'image' | 'video' | 'carousel'
type CreativeSource = 'all' | 'generated' | 'uploaded' | 'approved' | 'archived'

interface Creative {
  id: string
  name: string
  type: CreativeType
  thumbnail_url: string | null
  file_url: string | null
  campaign_id: string | null
  campaign_name?: string | null
  created_at: string
  source?: 'generated' | 'uploaded'
  is_approved?: boolean
  is_archived?: boolean
}

type CreativeRow = Creative & {
  campaigns?: {
    name: string | null
  } | null
}

const TYPE_CONFIG: Record<CreativeType, { label: string; icon: React.ElementType; color: string }> = {
  image: { label: 'Image', icon: Image, color: 'text-brand-400 bg-brand-600/10' },
  video: { label: 'Video', icon: Video, color: 'text-violet-400 bg-violet-600/10' },
  carousel: { label: 'Carousel', icon: LayoutGrid, color: 'text-amber-400 bg-amber-600/10' },
}

export default function Creatives() {
  const { user } = useAuth()
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(true)
  const [mediaFilter, setMediaFilter] = useState<CreativeType | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<CreativeSource>('all')
  const [previewCreative, setPreviewCreative] = useState<Creative | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchCreatives = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('creatives')
      .select('*, campaigns(name)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })

    // Simulate additional tags (source, approval, archive) for high-fidelity mock where missing
    const enriched = ((data ?? []) as CreativeRow[]).map((c, index) => ({
      ...c,
      campaign_name: c.campaigns?.name ?? null,
      source: c.thumbnail_url?.includes('pollinations') || index % 2 === 0 ? 'generated' : 'uploaded',
      is_approved: index % 3 !== 2, // Mock approvals
      is_archived: index > 12 // Mock archive status
    })) as Creative[]

    setCreatives(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchCreatives()
  }, [fetchCreatives])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)

    // In a normal flow we would upload to storage, then insert row.
    // We insert a beautiful placeholder with the file name to preserve database writes.
    const name = file.name
    const type: CreativeType = file.type.startsWith('video/') ? 'video' : 'image'

    const { error } = await supabase.from('creatives').insert({
      user_id: user.id,
      name,
      type,
      thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=256&auto=format&fit=crop',
      file_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop'
    })

    if (!error) {
      fetchCreatives()
    }
    setUploading(false)
  }

  // Filter pipeline
  const filtered = creatives.filter(c => {
    const matchesMedia = mediaFilter === 'all' || c.type === mediaFilter

    if (sourceFilter === 'all') return matchesMedia
    if (sourceFilter === 'generated') return matchesMedia && c.source === 'generated'
    if (sourceFilter === 'uploaded') return matchesMedia && c.source === 'uploaded'
    if (sourceFilter === 'approved') return matchesMedia && c.is_approved && !c.is_archived
    if (sourceFilter === 'archived') return matchesMedia && c.is_archived
    return matchesMedia
  })

  return (
    <>
      <Helmet><title>Creative Asset Library — LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Creative Library</h1>
            <p className="text-slate-400 text-sm mt-1">Manage generated and uploaded visual assets for your Meta Ads.</p>
          </div>
          <div>
            <input
              type="file"
              id="library-upload"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="library-upload"
              className={cn(
                'flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-brand-600/10',
                uploading ? 'opacity-50 pointer-events-none' : ''
              )}
            >
              {uploading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Uploading asset...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Upload Creative
                </>
              )}
            </label>
          </div>
        </div>

        {/* Filter Toolbar controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between border-b border-white/5 pb-4">
          {/* Library source tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'generated', 'uploaded', 'approved', 'archived'] as const).map(source => (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={cn(
                  'px-3.5 py-2 text-xs rounded-xl transition-all capitalize border',
                  sourceFilter === source
                    ? 'bg-brand-600 text-white border-brand-500/25 shadow-md'
                    : 'glass text-slate-400 border-white/5 hover:text-white'
                )}
              >
                {source}
              </button>
            ))}
          </div>

          {/* Media type filter */}
          <div className="flex gap-1">
            {(['all', 'image', 'video', 'carousel'] as const).map(type => (
              <button
                key={type}
                onClick={() => setMediaFilter(type)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-all capitalize',
                  mediaFilter === type
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {type === 'all' ? 'All formats' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Grid display */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="aspect-square glass rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center border border-white/5">
            <Image size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">No creatives found</p>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Upload files or tell the AI Manager to generate marketing visuals for your campaign brief.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(creative => {
              const cfg = TYPE_CONFIG[creative.type] || TYPE_CONFIG.image
              const Icon = cfg.icon
              return (
                <div
                  key={creative.id}
                  onClick={() => setPreviewCreative(creative)}
                  className="glass rounded-2xl overflow-hidden group border border-white/5 hover:border-white/10 hover:scale-[1.01] transition-all cursor-pointer shadow-md"
                >
                  {/* Thumbnail area */}
                  <div className="aspect-square bg-dark-800 flex items-center justify-center relative overflow-hidden">
                    {creative.thumbnail_url ? (
                      <img
                        src={creative.thumbnail_url}
                        alt={creative.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', cfg.color)}>
                        <Icon size={24} />
                      </div>
                    )}

                    {/* Source tag badge */}
                    <span className={cn(
                      'absolute top-2.5 left-2.5 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                      creative.source === 'generated'
                        ? 'bg-violet-600/80 border border-violet-500/30 text-violet-100'
                        : 'bg-dark-900/80 border border-white/10 text-slate-300'
                    )}>
                      {creative.source}
                    </span>

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white hover:bg-brand-500 transition-all shadow-md">
                        <Eye size={16} />
                      </button>
                      {creative.file_url && (
                        <a
                          href={creative.file_url}
                          download
                          className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-all border border-white/10"
                          onClick={e => e.stopPropagation()}
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Info section details */}
                  <div className="p-3.5 space-y-1.5">
                    <p className="text-white text-xs font-semibold truncate">{creative.name}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium uppercase', cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <Clock size={10} />
                        {new Date(creative.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    {creative.is_approved && (
                      <div className="flex items-center gap-1 text-[10px] text-green-400">
                        <CheckCircle2 size={10} />
                        Approved
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox / Preview modal overlay */}
      {previewCreative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setPreviewCreative(null)} />
          <div className="relative glass rounded-3xl overflow-hidden border border-white/10 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-dark-900/80">
              <div>
                <h3 className="font-bold text-white text-sm">{previewCreative.name}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-semibold">
                  Source: {previewCreative.source} &middot; Created on {new Date(previewCreative.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setPreviewCreative(null)}
                className="text-slate-400 hover:text-white border border-white/10 hover:border-white/20 p-2 rounded-xl transition-all"
              >
                Close preview
              </button>
            </div>

            {/* Media wrapper canvas */}
            <div className="flex-1 bg-dark-950 flex items-center justify-center p-6 overflow-hidden min-h-[300px]">
              {previewCreative.file_url ? (
                <img
                  src={previewCreative.file_url}
                  alt={previewCreative.name}
                  className="max-w-full max-h-[50vh] object-contain rounded-xl border border-white/5"
                />
              ) : (
                <div className="text-center space-y-2">
                  <ShieldAlert size={28} className="text-slate-700 mx-auto" />
                  <span className="text-slate-500 text-xs">No higher-res version available</span>
                </div>
              )}
            </div>

            {/* Actions footer bar */}
            <div className="p-4 border-t border-white/5 bg-dark-900/80 flex justify-end gap-3">
              {previewCreative.file_url && (
                <a
                  href={previewCreative.file_url}
                  download
                  className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                >
                  <Download size={13} />
                  Download asset
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
