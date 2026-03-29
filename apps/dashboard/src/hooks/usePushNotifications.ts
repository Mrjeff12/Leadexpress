// apps/dashboard/src/hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'granted' | 'loading'

export interface UsePushNotificationsResult {
  status: PushStatus
  enable: () => Promise<void>
  isLoading: boolean
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>('loading')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'granted') {
      setStatus('granted')
    } else if (perm === 'denied') {
      setStatus('denied')
    } else {
      setStatus('default')
    }
  }, [])

  const enable = useCallback(async () => {
    if (!user) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as PushStatus)
        return
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
      if (!vapidPublicKey) {
        console.error('VITE_VAPID_PUBLIC_KEY not set')
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'user_id,endpoint' }
      )

      if (error) {
        console.error('Failed to save push subscription:', error)
        return
      }

      setStatus('granted')
    } catch (err) {
      console.error('Push subscription failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  return { status, enable, isLoading }
}
