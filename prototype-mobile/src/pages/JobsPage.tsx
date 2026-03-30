import { useState } from 'react'
import { Clock, CheckCircle2, XCircle, Inbox, Phone, Navigation, Send, Eye, Users, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type View = 'taken' | 'published'

const takenJobs = [
  { type: 'Lock Rekey', from: 'James K.', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face', loc: 'Ft. Lauderdale', price: '$175', status: 'accepted', time: 'Today 10:00', step: 2 },
  { type: 'Smart Lock Install', from: 'David R.', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face', loc: 'Boca Raton', price: '$250', status: 'pending', time: 'Today 2:00', step: 0 },
  { type: 'Lockout Service', from: 'Sarah M.', photo: '', loc: 'Miami', price: '$95', status: 'completed', time: 'Yesterday', step: 3 },
  { type: 'Deadbolt Replace', from: 'Tom B.', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face', loc: 'Coral Gables', price: '$160', status: 'completed', time: 'Mar 25', step: 3 },
]

const publishedJobs = [
  { type: 'Kitchen Renovation', loc: 'Miami Beach', price: '$2,500', status: 'open', time: '2h ago', views: 14, responses: 0 },
  { type: 'Bathroom Plumbing', loc: 'Doral, FL', price: '$800', status: 'open', time: 'Yesterday', views: 31, responses: 3 },
  { type: 'AC Repair', loc: 'Coral Gables', price: '$450', status: 'assigned', time: 'Mar 26', views: 22, responses: 5, assignedTo: 'Carlos M.' },
]

const steps = ['Claimed', 'Driving', 'Working', 'Done']

export default function JobsPage() {
  const nav = useNavigate()
  const [view, setView] = useState<View>('taken')
  const earned = takenJobs.filter(j => j.status === 'completed').reduce((s, j) => s + parseInt(j.price.replace(/[$,]/g, '')), 0)

  return (
    <div className="page-content bg-white">
      <div className="px-5 pt-5 pb-6">

        <div className="flex items-center justify-between mb-4 anim-up">
          <h1 className="text-[22px] font-bold tracking-tight">Jobs</h1>
          <button onClick={() => nav('/rebeca')} className="w-9 h-9 rounded-full bg-[var(--brand)] flex items-center justify-center press">
            <Plus size={17} className="text-white" />
          </button>
        </div>

        {/* Toggle */}
        <div className="flex bg-[var(--gray-100)] rounded-xl p-1 mb-4 anim-up">
          <button onClick={() => setView('taken')}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${view === 'taken' ? 'bg-white shadow-sm' : 'text-muted'}`}>
            My Jobs <span className="opacity-50 ml-0.5">{takenJobs.length}</span>
          </button>
          <button onClick={() => setView('published')}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${view === 'published' ? 'bg-white shadow-sm' : 'text-muted'}`}>
            Published <span className="opacity-50 ml-0.5">{publishedJobs.length}</span>
          </button>
        </div>

        {view === 'taken' ? (
          <>
            <div className="flex items-center justify-between mb-3 px-0.5 anim-up">
              <span className="text-[11px] text-muted">{takenJobs.filter(j=>j.status==='completed').length} completed</span>
              <span className="text-[13px] font-bold text-green-600">${earned} earned</span>
            </div>

            <div className="space-y-2 stagger">
              {takenJobs.map((job, i) => {
                const isActive = job.status === 'accepted'
                const isPending = job.status === 'pending'
                return (
                  <div key={i} onClick={() => nav('/job')} className={`card overflow-hidden press anim-up ${isActive || isPending ? 'ring-1 ring-[var(--brand)]/10' : ''}`}>
                    <div className="px-3.5 py-3 flex items-center gap-3">
                      {/* Publisher photo */}
                      {job.photo ? (
                        <img src={job.photo} alt={job.from} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-[var(--dark)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {job.from.split(' ').map(n=>n[0]).join('')}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-semibold truncate">{job.type}</p>
                          <span className={`text-[9px] font-semibold ${
                            isActive ? 'text-[var(--brand)]' : isPending ? 'text-amber-500' : 'text-green-600'
                          }`}>{isActive ? 'Active' : isPending ? 'Pending' : 'Done'}</span>
                        </div>
                        <p className="text-[10px] text-muted">{job.from} · {job.loc} · {job.time}</p>
                      </div>
                      <span className="text-[13px] font-bold text-green-600 flex-shrink-0">{job.price}</span>
                    </div>

                    {isActive && (
                      <div className="px-3.5 pb-3 pt-0">
                        <div className="flex gap-0.5 mb-1.5">
                          {steps.map((_, si) => (
                            <div key={si} className={`h-[2px] flex-1 rounded-full ${si <= job.step ? 'bg-[var(--brand)]' : 'bg-[var(--gray-100)]'}`} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[var(--brand)] font-semibold">{steps[job.step]}</span>
                          <div className="flex gap-1.5">
                            <button onClick={e => e.stopPropagation()} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 press">
                              <Phone size={9} className="text-green-600" />
                              <span className="text-[9px] font-semibold text-green-600">Call</span>
                            </button>
                            <button onClick={e => e.stopPropagation()} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 press">
                              <Navigation size={9} className="text-blue-500" />
                              <span className="text-[9px] font-semibold text-blue-500">Go</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isPending && (
                      <div className="px-3.5 pb-3 pt-0 flex gap-1.5">
                        <button onClick={e => e.stopPropagation()} className="flex-1 py-2 rounded-lg bg-green-50 text-green-600 text-[11px] font-semibold press text-center">Accept</button>
                        <button onClick={e => e.stopPropagation()} className="flex-1 py-2 rounded-lg bg-red-50 text-red-400 text-[11px] font-semibold press text-center">Decline</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 px-0.5 anim-up">
              <span className="text-[11px] text-muted">{publishedJobs.filter(j=>j.status==='open').length} open</span>
            </div>

            <div className="space-y-2 stagger">
              {publishedJobs.map((job, i) => (
                <div key={i} onClick={() => nav('/published-job')} className={`card overflow-hidden press anim-up ${job.status === 'open' ? 'ring-1 ring-blue-500/10' : ''}`}>
                  <div className="px-3.5 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      job.status === 'open' ? 'bg-blue-50' : job.status === 'assigned' ? 'bg-green-50' : 'bg-[var(--gray-100)]'
                    }`}>
                      {job.status === 'open' ? <Send size={14} className="text-blue-500" /> :
                       <CheckCircle2 size={14} className="text-green-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold truncate">{job.type}</p>
                        <span className={`text-[9px] font-semibold ${job.status === 'open' ? 'text-blue-500' : 'text-green-600'}`}>
                          {job.status === 'open' ? 'Open' : 'Assigned'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted">{job.loc} · {job.time}</p>
                    </div>
                    <span className="text-[13px] font-bold text-green-600 flex-shrink-0">{job.price}</span>
                  </div>

                  <div className="px-3.5 pb-3 pt-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[9px] text-muted"><Eye size={9} />{job.views}</span>
                      <span className="flex items-center gap-1 text-[9px] text-muted"><Users size={9} />{job.responses}</span>
                    </div>
                    {job.status === 'open' && job.responses > 0 ? (
                      <span className="text-[9px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">View {job.responses}</span>
                    ) : job.status === 'assigned' ? (
                      <span className="text-[9px] font-semibold text-green-600">→ {(job as any).assignedTo}</span>
                    ) : (
                      <span className="text-[9px] text-faded italic">Waiting...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
