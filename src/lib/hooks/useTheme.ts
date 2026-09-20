/**
 * Hook para manejar el tema (light/dark) con persistencia en localStorage.
 * Detecta la preferencia del sistema operativo al primer uso.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'app-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const t = getInitialTheme()
    setThemeState(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme }
}
