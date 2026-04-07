import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

/* ── Types ─────────────────────────────────────────────── */

export interface ContractorProfile {
  user_id: string
  slug: string | null
  headline: string | null
  bio: string | null
  years_experience: number | null
  business_name: string | null
  license_number: string | null
  insurance_verified: boolean
  background_check: string
  languages: string[]
  team_size: number
  website_url: string | null
  avg_rating: number
  review_count: number
  completion_rate: number
  avg_response_mins: number | null
  reputation_score: number
  tier: 'new' | 'verified' | 'trusted' | 'elite'
  profile_completeness: number
  avatar_url: string | null
  accepts_percentage: boolean
  accepts_fixed: boolean
  accepts_subwork: boolean
  min_job_value: number | null
  max_job_value: number | null
}

export interface ContractorStats {
  leads_contacted: number
  successful_jobs: number
  feedbacks_given: number
  groups_active: number
  job_orders_total: number
  job_orders_completed: number
  avg_response_mins: number | null
  member_since: string
  network_points: number
  network_level: string
  available_today: boolean
}

export interface FullContractorProfile {
  // From profiles
  full_name: string | null
  phone: string | null
  whatsapp_phone: string | null
  counties: string[] | null
  // From contractors
  professions: string[]
  zip_codes: string[]
  // From contractor_profiles
  profile: ContractorProfile
  // Computed
  stats: ContractorStats
}

/* ── Hook ─────────────────────────────────────────────── */

export function useContractorProfile() {
  const { effectiveUserId } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['contractor-profile', effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async (): Promise<FullContractorProfile | null> => {
      if (!effectiveUserId) return null

      // Fire all 5 queries in parallel instead of sequentially
      const [cpRes, profileRes, contractorRes, statsRes, completenessRes] = await Promise.all([
        supabase.from('contractor_profiles').select('*').eq('user_id', effectiveUserId).maybeSingle(),
        supabase.from('profiles').select('full_name, phone, whatsapp_phone, counties').eq('id', effectiveUserId).maybeSingle(),
        supabase.from('contractors').select('professions, zip_codes').eq('user_id', effectiveUserId).maybeSingle(),
        supabase.rpc('calculate_contractor_stats', { p_user_id: effectiveUserId }),
        supabase.rpc('calculate_profile_completeness', { p_user_id: effectiveUserId }),
      ])

      const cp = cpRes.data
      const profile = profileRes.data
      const contractor = contractorRes.data
      const stats = statsRes.data
      const completeness = completenessRes.data

      if (!cp || !profile) return null

      return {
        full_name: profile.full_name,
        phone: profile.phone,
        whatsapp_phone: profile.whatsapp_phone,
        counties: profile.counties,
        professions: contractor?.professions ?? [],
        zip_codes: contractor?.zip_codes ?? [],
        profile: { ...cp, profile_completeness: completeness ?? cp.profile_completeness },
        stats: stats ?? {
          leads_contacted: 0, successful_jobs: 0, feedbacks_given: 0,
          groups_active: 0, job_orders_total: 0, job_orders_completed: 0,
          avg_response_mins: null, member_since: '', network_points: 0,
          network_level: 'member', available_today: false,
        },
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<ContractorProfile>) => {
      if (!effectiveUserId) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('contractor_profiles')
        .update(updates)
        .eq('user_id', effectiveUserId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractor-profile', effectiveUserId] })
    },
  })

  const publishProfile = useMutation({
    mutationFn: async () => {
      if (!effectiveUserId) throw new Error('Not authenticated')
      const { data: slug } = await supabase
        .rpc('generate_contractor_slug', { p_user_id: effectiveUserId })
      if (!slug) throw new Error('Failed to generate slug')
      const { error } = await supabase
        .from('contractor_profiles')
        .update({ slug })
        .eq('user_id', effectiveUserId)
      if (error) throw error
      return slug as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractor-profile', effectiveUserId] })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    publishProfile: publishProfile.mutateAsync,
    isPublishing: publishProfile.isPending,
    refetch: query.refetch,
  }
}

/* ── Public Profile Hook (no auth required) ─── */

export function usePublicProfile(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-profile', slug],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return null
      const { data, error } = await supabase.rpc('get_public_profile', { p_slug: slug })
      if (error) throw error
      return data as (FullContractorProfile & { profile: ContractorProfile; stats: ContractorStats }) | null
    },
  })
}
