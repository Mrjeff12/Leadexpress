import { Helmet } from 'react-helmet-async'

export default function GroupLeadsPage() {
  return (
    <>
      <Helmet>
        <title>Group Leads – MasterLeadFlow</title>
        <meta name="description" content="AI-powered WhatsApp group lead extraction for contractors" />
      </Helmet>
      <iframe
        src="https://app.masterleadflow.com/group-leads"
        className="w-full h-screen border-0"
        title="Group Leads"
      />
    </>
  )
}
