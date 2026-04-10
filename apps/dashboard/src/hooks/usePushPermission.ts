import { usePushNotifications } from './usePushNotifications'

/**
 * Thin adapter over usePushNotifications with a simpler shape for task list UIs:
 *   - hasPermission: user has already granted permission
 *   - canRequest: permission can still be requested (not denied, not unsupported)
 *   - isUnsupported: browser can't do web push at all (hide the task)
 *   - requestPermission: shows the native browser prompt + subscribes server-side
 */
export function usePushPermission() {
  const { status, enable, isLoading } = usePushNotifications()
  return {
    hasPermission: status === 'granted',
    canRequest: status === 'default',
    isUnsupported: status === 'unsupported' || status === 'denied',
    requestPermission: enable,
    isLoading,
  }
}
