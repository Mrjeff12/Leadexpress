import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useAdminKPIs } from '../../hooks/useAdminKPIs'
import { departments } from '../../config/departmentConfig'
import DepartmentNode from './DepartmentNode'
import { LogOut } from 'lucide-react'

const nodeTypes = { department: DepartmentNode }

const GRID_POSITIONS: [number, number][] = [
  [0, 0],     [350, 0],     [700, 0],
  [0, 260],   [350, 260],   [700, 260],
]

const EDGES: Edge[] = [
  { id: 'e-wr-cl', source: 'warroom', target: 'clients', style: { stroke: '#ff6b3530', strokeDasharray: '6 4' }, animated: false },
  { id: 'e-ch-wr', source: 'channels', target: 'warroom', style: { stroke: '#8b5cf630', strokeDasharray: '6 4' }, animated: false },
  { id: 'e-cl-fi', source: 'clients', target: 'finance', style: { stroke: '#10b98130', strokeDasharray: '6 4' }, animated: false },
]

export default function AdminCanvas() {
  const { profile, signOut } = useAuth()
  const { locale } = useI18n()
  const { data: kpis, loading } = useAdminKPIs()
  const he = locale === 'he'

  const nodes: Node[] = useMemo(
    () =>
      departments.map((dept, i) => ({
        id: dept.id,
        type: 'department',
        position: { x: GRID_POSITIONS[i][0], y: GRID_POSITIONS[i][1] },
        draggable: false,
        selectable: false,
        data: { department: dept, kpis, locale },
      })),
    [kpis, locale],
  )

  const onNodeClick = useCallback(() => {}, [])

  return (
    <div className="h-screen w-screen" style={{ background: '#0f0f1a' }}>
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="Lead Express" className="w-9 h-9 rounded-xl shadow-lg" />
          <div>
            <div className="text-white font-bold text-[15px]">Lead Express</div>
            <div className="text-white/30 text-[10px] font-bold tracking-widest uppercase">
              {he ? 'מרכז שליטה' : 'Control Center'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-white/50 text-[13px]">
              {profile.full_name}
            </span>
          )}
          <button
            onClick={signOut}
            className="text-white/30 hover:text-white/60 transition-colors"
            title={he ? 'התנתק' : 'Log Out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={EDGES}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="!bg-transparent"
          zoomOnScroll
          panOnScroll={false}
          panOnDrag
        >
          <Background color="#ffffff08" gap={40} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-white/5 !border-white/10 !rounded-xl [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/40 [&>button:hover]:!bg-white/10"
          />
        </ReactFlow>
      </ReactFlowProvider>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/20 text-[13px]">
        {he
          ? 'לחץ על כרטיס להיכנס | גלול לזום | גרור להזיז'
          : 'Click a card to enter | Scroll to zoom | Drag to pan'}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]/80 z-20">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
