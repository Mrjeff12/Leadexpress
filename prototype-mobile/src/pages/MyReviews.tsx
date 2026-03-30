import { ArrowLeft, Star, ThumbsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const reviews = [
  { name: 'Sarah M.', job: 'Lockout Service', rating: 5, text: 'Excellent work! Arrived in 10 minutes, very professional. Would definitely hire again.', time: '2 days ago', wouldHire: true },
  { name: 'James K.', job: 'Lock Rekey', rating: 5, text: 'Great job on the rekey. Fast, professional, and fair price.', time: '1 week ago', wouldHire: true },
  { name: 'David R.', job: 'Smart Lock Install', rating: 4, text: 'Good work overall. Took a bit longer than expected but the result was perfect.', time: '2 weeks ago', wouldHire: true },
  { name: 'Maria S.', job: 'Car Lockout', rating: 5, text: 'Saved my day! Got me back in my car in under 5 minutes.', time: '3 weeks ago', wouldHire: true },
  { name: 'Tom B.', job: 'Deadbolt Replace', rating: 4, text: 'Solid work. Clean installation. Reasonable price.', time: '1 month ago', wouldHire: true },
]

export default function MyReviews() {
  const nav = useNavigate()
  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
  const wouldHire = reviews.filter(r => r.wouldHire).length

  return (
    <div className="page-content bg-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => nav('/profile')} className="w-9 h-9 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
          <ArrowLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[18px] font-bold tracking-tight">My Reviews</h1>
      </div>

      <div className="px-5 pb-6">

        {/* Summary */}
        <div className="card p-5 mb-5 text-center anim-up">
          <p className="text-[36px] font-bold tracking-tight">{avg}</p>
          <div className="flex gap-0.5 justify-center mb-1">
            {[1,2,3,4,5].map(i => <Star key={i} size={14} className="text-amber-400" fill="#fbbf24" />)}
          </div>
          <p className="text-[12px] text-muted">{reviews.length} reviews</p>

          <div className="flex items-center justify-center gap-4 mt-4">
            <div>
              <div className="flex items-center gap-1 justify-center">
                <ThumbsUp size={12} className="text-green-600" />
                <span className="text-[16px] font-bold text-green-600">{Math.round(wouldHire/reviews.length*100)}%</span>
              </div>
              <p className="text-[10px] text-muted">Would hire again</p>
            </div>
          </div>

          {/* Rating bars */}
          <div className="mt-4 space-y-1">
            {[5,4,3,2,1].map(n => {
              const count = reviews.filter(r => r.rating === n).length
              const pct = (count / reviews.length) * 100
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted w-3">{n}</span>
                  <Star size={8} className="text-amber-400" fill="#fbbf24" />
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--gray-100)]">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-faded w-4">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reviews list */}
        <div className="space-y-2 stagger">
          {reviews.map((r, i) => (
            <div key={i} className="card p-4 anim-up">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[var(--dark)] flex items-center justify-center text-white text-[9px] font-bold">
                    {r.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold">{r.name}</p>
                    <p className="text-[10px] text-muted">{r.job}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex gap-0.5">{Array(r.rating).fill(0).map((_, j) => <Star key={j} size={8} className="text-amber-400" fill="#fbbf24" />)}</div>
                  <p className="text-[9px] text-faded mt-0.5">{r.time}</p>
                </div>
              </div>
              <p className="text-[12px] text-muted leading-relaxed">{r.text}</p>
              {r.wouldHire && (
                <div className="flex items-center gap-1 mt-2">
                  <ThumbsUp size={10} className="text-green-500" />
                  <span className="text-[10px] text-green-600 font-medium">Would hire again</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
