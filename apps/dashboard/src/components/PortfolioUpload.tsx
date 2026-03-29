import { useState, useRef, useCallback } from 'react'
import { Upload, X, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFESSIONS } from '../lib/professions'

interface PortfolioUploadProps {
  onUploaded: () => void
}

export default function PortfolioUpload({ onUploaded }: PortfolioUploadProps) {
  const { effectiveUserId } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const beforeInputRef = useRef<HTMLInputElement>(null)

  const [mainFile, setMainFile] = useState<File | null>(null)
  const [mainPreview, setMainPreview] = useState<string | null>(null)
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [beforePreview, setBeforePreview] = useState<string | null>(null)
  const [showBefore, setShowBefore] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((file: File, type: 'main' | 'before') => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    const url = URL.createObjectURL(file)
    if (type === 'main') {
      setMainFile(file)
      setMainPreview(url)
    } else {
      setBeforeFile(file)
      setBeforePreview(url)
    }
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, type: 'main' | 'before') => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file, type)
    },
    [handleFileSelect],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  async function uploadFile(file: File): Promise<string> {
    const ext = 'webp'
    const path = `${effectiveUserId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('portfolio-images')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('portfolio-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mainFile || !title.trim() || !effectiveUserId) return

    setSubmitting(true)
    setError(null)

    try {
      // Upload images
      const imageUrl = await uploadFile(mainFile)
      let beforeUrl: string | null = null
      if (beforeFile) {
        beforeUrl = await uploadFile(beforeFile)
      }

      // Insert portfolio item
      const { error: insertError } = await supabase.from('portfolio_items').insert({
        user_id: effectiveUserId,
        title: title.trim(),
        description: description.trim() || null,
        category: category || null,
        image_url: imageUrl,
        before_url: beforeUrl,
      })

      if (insertError) throw insertError

      // Reset form
      setMainFile(null)
      setMainPreview(null)
      setBeforeFile(null)
      setBeforePreview(null)
      setShowBefore(false)
      setTitle('')
      setDescription('')
      setCategory('')

      onUploaded()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Add Project</h3>

      {/* Main image upload */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">Project Photo *</label>
        {mainPreview ? (
          <div className="relative rounded-xl overflow-hidden aspect-video">
            <img src={mainPreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setMainFile(null)
                setMainPreview(null)
              }}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            onDrop={(e) => handleDrop(e, 'main')}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/40 bg-white/5 hover:bg-white/[.07] py-10 cursor-pointer transition-colors"
          >
            <Upload size={28} className="text-white/30" />
            <p className="text-sm text-white/40">Drag & drop or click to select</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFileSelect(f, 'main')
          }}
        />
      </div>

      {/* Before image toggle */}
      {!showBefore ? (
        <button
          type="button"
          onClick={() => setShowBefore(true)}
          className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          <Plus size={14} />
          Add before photo
        </button>
      ) : (
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Before Photo</label>
          {beforePreview ? (
            <div className="relative rounded-xl overflow-hidden aspect-video">
              <img src={beforePreview} alt="Before" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setBeforeFile(null)
                  setBeforePreview(null)
                }}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onDrop={(e) => handleDrop(e, 'before')}
              onDragOver={handleDragOver}
              onClick={() => beforeInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/40 bg-white/5 hover:bg-white/[.07] py-8 cursor-pointer transition-colors"
            >
              <Upload size={22} className="text-white/30" />
              <p className="text-xs text-white/40">Before photo</p>
            </div>
          )}
          <input
            ref={beforeInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f, 'before')
            }}
          />
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Kitchen Renovation in Miami"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the work..."
          rows={3}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
        >
          <option value="" className="bg-gray-900">Select a category</option>
          {PROFESSIONS.map((p) => (
            <option key={p.id} value={p.en} className="bg-gray-900">
              {p.emoji} {p.en}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!mainFile || !title.trim() || submitting}
        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-orange-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload size={16} />
            Add to Portfolio
          </>
        )}
      </button>
    </form>
  )
}
