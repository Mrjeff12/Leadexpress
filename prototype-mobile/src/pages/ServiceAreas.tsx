import { useState } from 'react'
import { ArrowLeft, Search, X, MapPin, Plus, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const savedZips = [
  { zip: '33130', city: 'Miami', state: 'FL' },
  { zip: '33101', city: 'Miami Downtown', state: 'FL' },
  { zip: '33301', city: 'Fort Lauderdale', state: 'FL' },
  { zip: '33431', city: 'Boca Raton', state: 'FL' },
]

const suggestions = [
  { zip: '33125', city: 'Miami - Little Havana', state: 'FL' },
  { zip: '33139', city: 'Miami Beach', state: 'FL' },
  { zip: '33180', city: 'Aventura', state: 'FL' },
  { zip: '33178', city: 'Doral', state: 'FL' },
]

export default function ServiceAreas() {
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const [zips, setZips] = useState(savedZips)

  const filtered = query.length >= 2 ? suggestions.filter(s =>
    s.zip.includes(query) || s.city.toLowerCase().includes(query.toLowerCase())
  ) : []

  return (
    <div className="page-content bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav('/profile')} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">Service Areas</h1>
      </div>

      {/* Map placeholder */}
      <div className="mx-5 h-[200px] rounded-2xl bg-[var(--gray-100)] relative overflow-hidden mb-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin size={24} className="text-[var(--brand)] mx-auto mb-1" />
            <p className="text-[12px] text-muted">Map with zip code zones</p>
            <p className="text-[10px] text-faded">4 areas selected</p>
          </div>
        </div>
        {/* Fake map pins */}
        <div className="absolute top-[40%] left-[30%] w-3 h-3 rounded-full bg-[var(--brand)] border-2 border-white shadow-sm" />
        <div className="absolute top-[35%] left-[50%] w-3 h-3 rounded-full bg-[var(--brand)] border-2 border-white shadow-sm" />
        <div className="absolute top-[55%] left-[45%] w-3 h-3 rounded-full bg-[var(--brand)] border-2 border-white shadow-sm" />
        <div className="absolute top-[60%] left-[65%] w-3 h-3 rounded-full bg-[var(--brand)] border-2 border-white shadow-sm" />
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2 bg-[var(--gray-50)] rounded-xl px-3.5 py-3">
          <Search size={16} className="text-[var(--gray-400)]" />
          <input type="text" placeholder="Search zip code or city..."
            value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder-[var(--gray-400)]" />
          {query && (
            <button onClick={() => setQuery('')} className="press">
              <X size={14} className="text-[var(--gray-400)]" />
            </button>
          )}
        </div>

        {/* Search results */}
        {filtered.length > 0 && (
          <div className="card mt-2 overflow-hidden">
            {filtered.map((s, i) => (
              <button key={i} onClick={() => { setZips([...zips, s]); setQuery('') }}
                className="w-full flex items-center gap-3 px-4 py-3 press text-left"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                <Plus size={16} className="text-[var(--brand)]" />
                <div>
                  <p className="t-sub text-[13px]">{s.city}</p>
                  <p className="text-[10px] text-muted">{s.zip} · {s.state}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current areas */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-2">
          <p className="t-label">Your Areas ({zips.length})</p>
        </div>
        <div className="space-y-2">
          {zips.map((z, i) => (
            <div key={i} className="card p-3.5 flex items-center gap-3 anim-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-light)] flex items-center justify-center">
                <MapPin size={15} className="text-[var(--brand)]" />
              </div>
              <div className="flex-1">
                <p className="t-sub text-[13px]">{z.city}</p>
                <p className="text-[10px] text-muted">{z.zip} · {z.state}</p>
              </div>
              <button className="w-7 h-7 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
                <X size={12} className="text-[var(--gray-400)]" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="px-5 mt-5">
        <button onClick={() => nav('/profile')} className="w-full btn-dark">
          <Check size={16} /> Save Areas
        </button>
      </div>
    </div>
  )
}
