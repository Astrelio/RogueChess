import { useState } from 'react'
import { useInbox } from '@portalsdk/react'
import { portalReady } from '@/lib/portal'

export type PortalToast = {
  id: string
  title: string
  body?: string
}

/**
 * Inbox Portal: retos / mentions. Anónimos → vacío permanente.
 */
export function usePortalInbox() {
  const [toasts, setToasts] = useState<PortalToast[]>([])

  const { counter, status, markAllRead } = useInbox({
    onItem: (item) => {
      setToasts((cur) => [
        ...cur,
        {
          id: item.id,
          title: item.title ?? item.type,
          body: typeof item.data === 'object' && item.data && 'message' in item.data
            ? String((item.data as { message?: string }).message ?? '')
            : undefined,
        },
      ])
    },
  })

  function dismiss(id: string) {
    setToasts((cur) => cur.filter((t) => t.id !== id))
  }

  return {
    ready: portalReady && status === 'ready',
    badge: counter,
    toasts,
    dismiss,
    markAllRead,
  }
}
