'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Por favor, completa todos los campos.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSuccessMsg('¡Registro exitoso! Redirigiendo al inicio de sesión...')
      // Redirigir al login después de un breve momento para que el usuario lea el mensaje
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Crea tu cuenta
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Regístrate para comenzar a gestionar tus facturas.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          <div className="space-y-4">
            
            {/* Nombres */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="firstName">
                  Nombre
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                  placeholder="Tu nombre"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="lastName">
                  Apellido
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                  placeholder="Tu apellido"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="confirmPassword">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-md border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-md border border-emerald-200 dark:border-emerald-900">
              {successMsg}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-violet-600 py-2.5 px-4 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Registrando...' : 'Completar registro'}
            </button>
            
            <div className="text-center mt-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">¿Ya tienes cuenta? </span>
              <Link
                href="/login"
                className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
              >
                Inicia sesión aquí
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
