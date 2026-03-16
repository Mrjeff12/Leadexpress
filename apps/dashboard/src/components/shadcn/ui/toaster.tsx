"use client"

import { useToast } from "@/components/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/shadcn/ui/toast"

type AnyToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  [key: string]: any
}

export function Toaster() {
  const { toasts } = useToast() as { toasts: AnyToast[] }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }: AnyToast) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
