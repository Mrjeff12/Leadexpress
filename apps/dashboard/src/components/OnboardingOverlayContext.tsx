import { createContext, useContext } from 'react'

export const OnboardingOverlayContext = createContext<{
  active: boolean
  setActive: (v: boolean) => void
}>({ active: false, setActive: () => {} })

export const useOnboardingOverlay = () => useContext(OnboardingOverlayContext)
