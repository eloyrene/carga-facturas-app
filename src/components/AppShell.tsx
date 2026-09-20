/**
 * AppShell — Layout protegido para todas las páginas autenticadas.
 * Server Component: verifica sesión y obtiene email del usuario.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

export default async function AppShell({ children }: AppShellProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar userEmail={user.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
