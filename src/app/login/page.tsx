'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Por favor, ingresa tu correo y contraseña.')
      return
    }
    
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Bienvenido
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Inicia sesión para cargar tus facturas.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="sr-only" htmlFor="email-address">
                Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-t-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:z-10 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-b-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:z-10 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-md border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-violet-600 py-2 px-4 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Iniciando...' : 'Iniciar sesión'}
            </button>
            
            <div className="text-center mt-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">¿No tienes cuenta? </span>
              <Link
                href="/register"
                className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
              >
                Regístrate aquí
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
