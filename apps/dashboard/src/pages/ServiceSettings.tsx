import { Save, CheckCircle, Settings } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { useContractorSettings } from '../hooks/useContractorSettings'
import ProfessionGrid from '../components/settings/ProfessionGrid'
import ZipManager from '../components/settings/ZipManager'
import WorkingSchedule from '../components/settings/WorkingSchedule'
import CoverageMap from '../components/settings/CoverageMap'

export default function ServiceSettings() {
  const { locale } = useI18n()
  const {
    professions, zipCodes, workingHours,
    loading, saving, saved,
    toggleProfession, addZipCode, removeZipCode,
    setWorkingHours, save,
  } = useContractorSettings()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#fee8df] text-[#c43d10]">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              {locale === 'he' ? 'הגדרות שירות' : 'Service Settings'}
            </h1>
            <p className="text-sm text-zinc-500">
              {locale === 'he'
                ? 'נהל מקצועות, אזורים ולוח זמנים'
                : 'Manage professions, coverage areas & schedule'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#e04d1c] animate-fade-in">
              <CheckCircle className="h-4 w-4" />
              {locale === 'he' ? 'נשמר!' : 'Saved!'}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? (
              <div className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {locale === 'he' ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel */}
        <div className="w-full lg:w-[350px] shrink-0 space-y-6">
          <div className="glass-panel p-5">
            <ProfessionGrid selected={professions} onToggle={toggleProfession} />
          </div>
          <div className="glass-panel p-5">
            <ZipManager zipCodes={zipCodes} onAdd={addZipCode} onRemove={removeZipCode} />
          </div>
        </div>

        {/* Right Area */}
        <div className="flex-1 space-y-6">
          <div className="glass-panel p-0 overflow-hidden h-[350px] lg:h-[400px]">
            <CoverageMap zipCodes={zipCodes} />
          </div>
          <div className="glass-panel p-5">
            <WorkingSchedule hours={workingHours} onChange={setWorkingHours} />
          </div>
        </div>
      </div>
    </div>
  )
}
