import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Fingerprint,
} from 'lucide-react'
import { useIdentityVerification } from '../hooks/useIdentityVerification'

const ERROR_MESSAGES: Record<string, string> = {
  consent_declined: 'You declined the consent. Please try again to verify your identity.',
  document_expired: 'The document you provided has expired. Please use a valid document.',
  document_type_not_supported: 'This document type is not supported. Please use a passport, driver\'s license, or ID card.',
  document_unverified_other: 'We could not verify your document. Please try again with a clearer photo.',
  selfie_document_missing_photo: 'The document photo could not be detected. Please try again.',
  selfie_face_mismatch: 'The selfie does not match the photo on your document. Please try again.',
  selfie_manipulated: 'The selfie appears to be manipulated. Please take a live photo.',
  selfie_unverified_other: 'We could not verify your selfie. Please try again.',
  under_supported_age: 'You must be at least 18 years old to verify your identity.',
}

export default function IdentityVerification() {
  const [searchParams] = useSearchParams()
  const completed = searchParams.get('completed') === 'true'

  const {
    verification,
    loading,
    actionLoading,
    status,
    isVerified,
    isPending,
    needsRetry,
    startVerification,
    refetch,
  } = useIdentityVerification()

  // Refetch when returning from Stripe
  useEffect(() => {
    if (completed) {
      const timer = setTimeout(() => refetch(), 2000)
      return () => clearTimeout(timer)
    }
  }, [completed, refetch])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Fingerprint className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Identity Verification</h1>
          <p className="text-gray-500">Verify your identity to unlock full platform features</p>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Verified */}
        {isVerified && (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-green-800">Identity Verified</h2>
            <p className="text-gray-600">
              Your identity has been successfully verified
              {verification?.verified_at && (
                <> on {new Date(verification.verified_at).toLocaleDateString()}</>
              )}
            </p>
            {verification?.first_name && (
              <div className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-green-800 font-medium">
                  {verification.first_name} {verification.last_name}
                </span>
                {verification.document_type && (
                  <span className="text-green-600 text-sm">
                    ({verification.document_type.replace('_', ' ')})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending / Processing */}
        {isPending && (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-600 animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-yellow-800">Verification In Progress</h2>
            <p className="text-gray-600">
              Your identity is being verified. This usually takes a few minutes.
            </p>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <RefreshCw className="w-4 h-4" />
              Check status
            </button>
          </div>
        )}

        {/* Returned from Stripe but still pending */}
        {completed && isPending && (
          <div className="px-8 pb-6 text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                We received your submission. Results will appear here shortly.
              </p>
            </div>
          </div>
        )}

        {/* Needs retry */}
        {needsRetry && (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-red-800">Verification Failed</h2>
            <p className="text-gray-600">
              {verification?.error_code
                ? ERROR_MESSAGES[verification.error_code] || verification.error_reason || 'An error occurred during verification.'
                : 'The verification could not be completed. Please try again.'}
            </p>
            <button
              onClick={startVerification}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Try Again
            </button>
          </div>
        )}

        {/* Not started */}
        {status === 'none' && (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Fingerprint className="w-8 h-8 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">Verify Your Identity</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Complete a quick identity check to verify your contractor license and unlock all platform features.
              </p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 mb-1">1</div>
                <p className="text-sm text-gray-700">Take a photo of your ID document</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 mb-1">2</div>
                <p className="text-sm text-gray-700">Take a selfie for face matching</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 mb-1">3</div>
                <p className="text-sm text-gray-700">Get verified in minutes</p>
              </div>
            </div>

            <button
              onClick={startVerification}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
            >
              {actionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
              Start Verification
            </button>

            <p className="text-xs text-gray-400">
              Powered by Stripe Identity. Your data is encrypted and securely processed.
            </p>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-3">
        <h3 className="font-semibold text-gray-900">What we verify</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            Government-issued ID (passport, driver's license, or ID card)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            Selfie matching to confirm you are the document holder
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            Liveness detection to prevent fraud
          </li>
        </ul>
        <p className="text-xs text-gray-400 pt-2">
          Your documents are processed by Stripe and are not stored on our servers.
          Biometric data is automatically deleted within 1 year.
        </p>
      </div>
    </div>
  )
}
