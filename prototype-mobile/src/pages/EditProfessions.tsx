import { useState } from 'react'
import { ArrowLeft, Search, Check, X, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const allProfessions = [
  { name: 'Locksmith', category: 'Security' },
  { name: 'Lock Rekey', category: 'Security' },
  { name: 'Smart Locks', category: 'Security' },
  { name: 'Safe Opening', category: 'Security' },
  { name: 'Plumber', category: 'Plumbing' },
  { name: 'Drain Cleaning', category: 'Plumbing' },
  { name: 'Water Heater', category: 'Plumbing' },
  { name: 'Electrician', category: 'Electrical' },
  { name: 'Panel Upgrade', category: 'Electrical' },
  { name: 'HVAC', category: 'Climate' },
  { name: 'AC Repair', category: 'Climate' },
  { name: 'Painter', category: 'Finishing' },
  { name: 'Roofer', category: 'Exterior' },
  { name: 'General Contractor', category: 'General' },
  { name: 'Handyman', category: 'General' },
  { name: 'Carpenter', category: 'General' },
]

export default function EditProfessions() {
  const nav = useNavigate()
  const [selected, setSelected] = useState(['Locksmith', 'Lock Rekey', 'Smart Locks'])
  const [query, setQuery] = useState('')

  const filtered = query
    ? allProfessions.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : allProfessions

  const toggle = (name: string) => {
    setSelected(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name])
  }

  const categories = [...new Set(filtered.map(p => p.category))]

  return (
    <div className="page-content bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav('/profile')} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight flex-1">My Services</h1>
        <span className="text-[12px] text-[var(--brand)] font-semibold">{selected.length} selected</span>
      </div>

      <div className="px-5 pb-6">

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 anim-up">
            {selected.map(s => (
              <button key={s} onClick={() => toggle(s)}
                className="flex items-center gap-1.5 bg-[var(--brand)] text-white text-[12px] font-medium px-3 py-1.5 rounded-full press">
                {s} <X size={11} />
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 card px-3.5 py-3 mb-4 anim-up">
          <Search size={15} className="text-[var(--gray-400)]" />
          <input type="text" placeholder="Search services..." value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 text-[14px] outline-none placeholder-[var(--gray-400)]" />
          {query && <button onClick={() => setQuery('')}><X size={13} className="text-[var(--gray-400)]" /></button>}
        </div>

        {/* List by category */}
        {categories.map(cat => (
          <div key={cat} className="mb-4 anim-up">
            <p className="t-label mb-2">{cat}</p>
            <div className="card overflow-hidden">
              {filtered.filter(p => p.category === cat).map((p, i, arr) => {
                const on = selected.includes(p.name)
                return (
                  <button key={p.name} onClick={() => toggle(p.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 press text-left ${on ? 'bg-[var(--brand-light)]' : ''}`}
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                    <span className={`text-[13px] ${on ? 'font-semibold text-[var(--brand)]' : 'font-medium'}`}>{p.name}</span>
                    {on && <div className="w-5 h-5 rounded-full bg-[var(--brand)] flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Save */}
        <button onClick={() => nav('/profile')}
          className="w-full bg-[var(--dark)] text-white py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 press">
          <Check size={16} /> Save Services
        </button>

        <div className="bg-[var(--brand-light)] rounded-xl p-3 mt-3 text-center">
          <p className="text-[10px] text-[var(--brand)]">
            <Star size={9} className="inline" /> Premium: Unlimited services · Free: Up to 3
          </p>
        </div>
      </div>
    </div>
  )
}
