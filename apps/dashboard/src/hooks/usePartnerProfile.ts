import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export interface PartnerProfile {
  id: string
  user_id: string
  slug: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  cover_image_url: string | null
  location: string | null
  service_areas: string[]
  specialties: string[]
  commission_rate: number
  status: string
  verified_at: string | null
  balance_cache_cents: number
  payout_method: string | null
  payout_details: string | null
  stripe_connect_id: string | null
  stripe_onboarded: boolean
  stats: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function usePartnerProfile() {
  const { effectiveUserId } = useAuth()
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPartner = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }

    const { data, error: err } = await supabase
      .from('community_partners')
      .select('*')
      .eq('user_id', effectiveUserId)
      .maybeSingle()

    if (err) {
      setError(err.message)
    } else {
      setPartner(data as PartnerProfile | null)
    }
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => {
    loadPartner()
  }, [loadPartner])

  const updateProfile = useCallback(async (updates: Partial<Pick<PartnerProfile, 'display_name' | 'bio' | 'location' | 'service_areas' | 'specialties' | 'slug' | 'payout_method' | 'payout_details'>>) => {
    if (!partner) throw new Error('No partner profile')

    const { error: err } = await supabase.rpc('update_partner_profile', {
      p_display_name: updates.display_name ?? null,
      p_bio: updates.bio ?? null,
      p_location: updates.location ?? null,
      p_service_areas: updates.service_areas ?? null,
      p_specialties: updates.specialties ?? null,
      p_slug: updates.slug ?? null,
      p_payout_method: updates.payout_method ?? null,
      p_payout_details: updates.payout_details ?? null,
    })

    if (err) throw err
    await loadPartner()
  }, [partner, loadPartner])

  const checkSlugAvailable = useCallback(async (slug: string): Promise<boolean> => {
    const { data } = await supabase
      .from('community_partners')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    // Available if no record found, or found record is our own
    return !data || data.id === partner?.id
  }, [partner])

  return {
    partner,
    loading,
    error,
    updateProfile,
    checkSlugAvailable,
    refetch: loadPartner,
  }
}
