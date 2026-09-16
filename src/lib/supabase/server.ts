/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers
 * Usa @supabase/ssr createServerClient con cookies de next/headers.
 *
 * Uso en Server Components / Actions:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = await createClient()
 *
 * IMPORTANTE: Esta función es async porque cookies() es async en Next.js 16+
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll puede fallar en Server Components de solo lectura.
            // Si tienes middleware refrescando sesiones, puedes ignorar este error.
          }
        },
      },
    },
  )
}
