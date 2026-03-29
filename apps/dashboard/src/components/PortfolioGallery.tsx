import { useState } from 'react'
import { Star, Trash2, ImageIcon, ArrowLeftRight } from 'lucide-react'

interface PortfolioItem {
  id: string
  title: string
  description: string | null
  category: string | null
  image_url: string
  before_url: string | null
  is_featured: boolean
}

interface PortfolioGalleryProps {
  items: PortfolioItem[]
  editable?: boolean
  onDelete?: (id: string) => void
}

function BeforeAfterCard({ item }: { item: PortfolioItem }) {
  const [showAfter, setShowAfter] = useState(true)

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl group">
      {/* Image */}
      <img
        src={showAfter ? item.image_url : (item.before_url ?? item.image_url)}
        alt={item.title}
        className="w-full h-full object-cover transition-opacity duration-300"
      />

      {/* Before/After toggle */}
      <button
        onClick={() => setShowAfter((v) => !v)}
        className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white hover:bg-black/80 transition-colors"
      >
        <ArrowLeftRight size={12} />
        {showAfter ? 'After' : 'Before'}
      </button>
    </div>
  )
}

function PortfolioCard({
  item,
  editable,
  onDelete,
}: {
  item: PortfolioItem
  editable?: boolean
  onDelete?: (id: string) => void
}) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all">
      {/* Image */}
      {item.before_url ? (
        <BeforeAfterCard item={item} />
      ) : (
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Featured badge */}
      {item.is_featured && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-sm px-2 py-0.5 text-xs font-bold text-white">
          <Star size={12} fill="currentColor" />
          Featured
        </div>
      )}

      {/* Delete button (editable mode) */}
      {editable && onDelete && (
        <button
          onClick={() => onDelete(item.id)}
          className="absolute top-2 right-2 rounded-full bg-red-500/80 backdrop-blur-sm p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Title overlay */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
        <h4 className="text-white font-semibold text-sm truncate">{item.title}</h4>
        {item.category && (
          <span className="text-white/50 text-xs">{item.category}</span>
        )}
      </div>
    </div>
  )
}

export default function PortfolioGallery({ items, editable, onDelete }: PortfolioGalleryProps) {
  if (items.length === 0) {
    return (
      <div className="glass-panel p-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <ImageIcon size={24} className="text-white/30" />
        </div>
        <p className="text-white/50 text-sm">Add your first project to showcase your work</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item) => (
        <PortfolioCard
          key={item.id}
          item={item}
          editable={editable}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
