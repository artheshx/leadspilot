import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileText, Upload, Trash2, AlertCircle, ToggleLeft, ToggleRight, Eye, History, X } from 'lucide-react'
import { adminGet, adminSend, adminUpload, AdminApiError } from '@/lib/adminApi'

interface KbDocument {
  id: string
  name: string
  category: string
  version: number
  updated_at: string
  enabled: boolean
  status: 'healthy' | 'processing' | 'failed'
  status_message: string | null
  chunk_count: number
  original_filename: string
  size_bytes: number
}

interface KbDocumentVersion {
  id: string
  version: number
  original_filename: string
  chunk_count: number
  created_at: string
}

const CATEGORIES = ['Meta Ads', 'Google Ads', 'Copywriting', 'Funnels', 'Healthcare', 'Real Estate', 'Gym', 'Restaurant', 'General']

export default function AdminKnowledgeBase() {
  const [documents, setDocuments] = useState<KbDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [docName, setDocName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('Meta Ads')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string; text: string; truncated: boolean } | null>(null)
  const [versionsDoc, setVersionsDoc] = useState<{ id: string; name: string; versions: KbDocumentVersion[] } | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setDocuments(await adminGet<KbDocument[]>('/knowledge-base'))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load knowledge base documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (id: string) => {
    setBusyId(id)
    try {
      const updated = await adminSend<KbDocument>(`/knowledge-base/${id}/toggle`, 'POST')
      setDocuments(prev => prev.map(d => (d.id === id ? updated : d)))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to toggle document.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Knowledge Base document?')) return
    setBusyId(id)
    try {
      await adminSend(`/knowledge-base/${id}`, 'DELETE')
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to delete document.')
    } finally {
      setBusyId(null)
    }
  }

  const handleShowVersions = async (doc: KbDocument) => {
    try {
      const versions = await adminGet<KbDocumentVersion[]>(`/knowledge-base/${doc.id}/versions`)
      setVersionsDoc({ id: doc.id, name: doc.name, versions })
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load version history.')
    }
  }

  const handleRollback = async (docId: string, version: number) => {
    if (!confirm(`Roll back to version ${version}?`)) return
    try {
      const updated = await adminSend<KbDocument>(`/knowledge-base/${docId}/rollback/${version}`, 'POST')
      setDocuments(prev => prev.map(d => (d.id === docId ? updated : d)))
      setVersionsDoc(null)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to roll back document.')
    }
  }

  const handlePreview = async (doc: KbDocument) => {
    try {
      const result = await adminGet<{ id: string; preview: string; truncated: boolean }>(`/knowledge-base/${doc.id}/preview`)
      setPreviewDoc({ id: doc.id, name: doc.name, text: result.preview, truncated: result.truncated })
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to preview document.')
    }
  }

  const handleReplaceClick = (id: string) => {
    setReplaceTargetId(id)
    replaceInputRef.current?.click()
  }

  const handleReplaceFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetId = replaceTargetId
    e.target.value = ''
    if (!file || !targetId) return
    setBusyId(targetId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const updated = await adminUpload<KbDocument>(`/knowledge-base/${targetId}/replace`, 'PUT', formData)
      setDocuments(prev => prev.map(d => (d.id === targetId ? updated : d)))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to replace document.')
    } finally {
      setBusyId(null)
      setReplaceTargetId(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('name', docName || selectedFile.name)
      formData.append('category', selectedCategory)
      formData.append('file', selectedFile)
      const created = await adminUpload<KbDocument>('/knowledge-base/upload', 'POST', formData)
      setDocuments(prev => [created, ...prev])
      setSelectedFile(null)
      setDocName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to upload document.')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return iso }
  }
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`

  // Real aggregate metrics — no retrieval-count or embedding-count fabrication.
  const totalDocs = documents.length
  const totalChunks = documents.reduce((acc, d) => acc + d.chunk_count, 0)
  const activeDocsCount = documents.filter(d => d.enabled).length
  const disabledDocsCount = documents.filter(d => !d.enabled).length
  const categoriesCount = new Set(documents.map(d => d.category)).size

  return (
    <>
      <Helmet><title>AI Knowledge Base — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI Knowledge Base</h1>
          <p className="text-slate-500 text-sm mt-1">Upload Playbooks and SOPs. Documents are parsed and chunked now; embedding into a vector store for retrieval is a future phase (see note below).</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Analytics Header Grid — only real, derived numbers */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Documents</span>
            <span className="text-2xl font-bold text-slate-800 block mt-1">{totalDocs}</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-1">{activeDocsCount} active &middot; {disabledDocsCount} inactive</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Chunks Parsed</span>
            <span className="text-2xl font-bold text-slate-800 block mt-1">{totalChunks}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Not yet embedded (see note)</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Categories in use</span>
            <span className="text-2xl font-bold text-slate-800 block mt-1">{categoriesCount}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Failed Documents</span>
            <span className="text-2xl font-bold text-slate-800 block mt-1">{documents.filter(d => d.status === 'failed').length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Playbooks & SOPs</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-100 rounded-full px-2 py-0.5">{documents.length} Docs</span>
              </div>

              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center text-sm text-slate-400">Loading documents…</div>
                ) : documents.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No documents uploaded yet.</div>
                ) : documents.map(doc => (
                  <div key={doc.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">{doc.name}</p>
                          <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.2 rounded border font-bold uppercase ${
                            doc.status === 'healthy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            doc.status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Category: <span className="text-slate-600 font-semibold">{doc.category}</span> &middot; Ver {doc.version} &middot; Chunks: {doc.chunk_count} &middot; {formatSize(doc.size_bytes)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Updated: {formatDate(doc.updated_at)} {doc.status_message ? `— ${doc.status_message}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center self-end flex-shrink-0 flex-wrap">
                      <button
                        onClick={() => handleToggle(doc.id)}
                        disabled={busyId === doc.id}
                        className="text-slate-400 hover:text-slate-600"
                        title={doc.enabled ? 'Disable document' : 'Enable document'}
                      >
                        {doc.enabled ? <ToggleRight className="text-blue-600" size={24} /> : <ToggleLeft size={24} />}
                      </button>

                      <button
                        onClick={() => handlePreview(doc)}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1"
                        title="Preview extracted text"
                      >
                        <Eye size={11} /> Preview
                      </button>

                      <button
                        onClick={() => handleReplaceClick(doc.id)}
                        disabled={busyId === doc.id}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold"
                        title="Replace with a new file (bumps version)"
                      >
                        Replace
                      </button>

                      <button
                        onClick={() => handleShowVersions(doc)}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        title="Version history"
                      >
                        <History size={11} /> History
                      </button>

                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={busyId === doc.id}
                        className="p-1.5 border border-red-100 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                        title="Delete playbook"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upload drawer */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Add Knowledge Playbook</h3>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Document Name</label>
                  <input
                    type="text"
                    value={docName}
                    onChange={e => setDocName(e.target.value)}
                    placeholder="Defaults to the filename"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category *</label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Select Document</label>
                  <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-all cursor-pointer relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.docx,.txt,.md"
                    />
                    <Upload size={20} className="text-slate-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-500 block font-semibold">
                      {selectedFile ? selectedFile.name : 'Upload PDF, DOCX, TXT or MD'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">Max limit 20MB</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Upload size={13} />
                  {uploading ? 'Uploading & Parsing...' : 'Upload Document'}
                </button>
              </form>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900/70 leading-relaxed">
                <span className="font-bold block text-blue-800 mb-0.5">Chunking only — embeddings are a future phase</span>
                Uploads are parsed and split into chunks (same chunker as the per-business RAG pipeline) and
                stored with version history. They are <strong>not</strong> yet embedded into a vector store or
                retrievable by the AI Manager — that requires wiring this table into an embedding pipeline,
                intentionally deferred per scope.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden input used for the "Replace" action */}
      <input ref={replaceInputRef} type="file" onChange={handleReplaceFileChosen} className="hidden" accept=".pdf,.docx,.txt,.md" />

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewDoc(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">{previewDoc.name}</h2>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{previewDoc.text || 'No extractable text.'}</pre>
            {previewDoc.truncated && <p className="text-[10px] text-slate-400 mt-3">Preview truncated to the first 5,000 characters.</p>}
          </div>
        </div>
      )}

      {/* Version history modal */}
      {versionsDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setVersionsDoc(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Version History — {versionsDoc.name}</h2>
              <button onClick={() => setVersionsDoc(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {versionsDoc.versions.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">Version {v.version}</span>
                    <span className="text-slate-400 block">{v.original_filename} &middot; {v.chunk_count} chunks &middot; {formatDate(v.created_at)}</span>
                  </div>
                  <button
                    onClick={() => handleRollback(versionsDoc.id, v.version)}
                    className="py-1 px-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600"
                  >
                    Roll back
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
