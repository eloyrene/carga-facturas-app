'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/lib/hooks/useTheme'

export default function ToasterProvider() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        duration: 5000,
        style: {
          fontFamily: 'var(--font-geist-sans)',
        },
      }}
    />
  )
}
