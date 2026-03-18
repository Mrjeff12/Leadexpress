import GroupScanLinksPanel from '../components/contractor/GroupScanLinksPanel'
import { useI18n } from '../lib/i18n'

export default function ContractorGroupScan() {
  const { locale } = useI18n()

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
          {locale === 'he' ? 'קבוצות לסריקה' : 'Group Scan'}
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {locale === 'he' 
            ? 'נהל את קבוצות ה-WhatsApp שאתה רוצה שהמערכת תסרוק עבורך' 
            : 'Manage the WhatsApp groups you want the system to scan for you'}
        </p>
      </div>

      <GroupScanLinksPanel />
    </div>
  )
}
