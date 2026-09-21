import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Dashboard de Inventario',
  description: 'Métricas KPI y maestro de productos del inventario.',
}

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: string
  accent: string
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-6 ${accent}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
    needs_review: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
    pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400',
  }
  const labels: Record<string, string> = {
    processed: 'Procesada',
    needs_review: 'Revisión',
    pending: 'Pendiente',
    failed: 'Fallida',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // ── Métricas de Facturas ─────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const [
    { count: totalInvoicesCount },
    { data: invoicesToday },
    { data: allInvoices },
    { data: processedInvoices },
    { data: pendingInvoices },
  ] = await Promise.all([
    supabase.from('invoices').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id').gte('created_at', todayIso),
    supabase.from('invoices').select('id, vendor_name, invoice_number, invoice_date, total_amount, status, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('invoices').select('total_amount').eq('status', 'processed'),
    supabase.from('invoices').select('id').in('status', ['pending', 'needs_review']),
  ])

  const processedToday = invoicesToday?.length ?? 0
  const totalCount = totalInvoicesCount ?? 0
  const totalAmountSum = processedInvoices?.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0) ?? 0
  const pendingCount = pendingInvoices?.length ?? 0

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard de Facturas</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Resumen de actividad, facturas procesadas en el día e historial reciente.
          </p>
        </div>

        {/* KPI Cards */}
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Procesadas Hoy"
              value={processedToday}
              sub="facturas con éxito hoy"
              icon="✅"
              accent="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            />
            <KpiCard
              label="Total de Facturas"
              value={totalCount.toLocaleString('es-MX')}
              sub="facturas registradas"
              icon="📑"
              accent="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            />
            <KpiCard
              label="Monto Total Procesado"
              value={formatCurrency(totalAmountSum)}
              sub="acumulado en facturas"
              icon="💰"
              accent="border-violet-200 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20"
            />
            <KpiCard
              label="Facturas Pendientes"
              value={pendingCount}
              sub="en cola o revisión"
              icon="⏳"
              accent="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
            />
          </div>
        </section>

        {/* Recent Invoices Table */}
        <section>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                  Historial Reciente de Facturas
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Últimas facturas procesadas y registradas en el sistema.
                </p>
              </div>
              <a
                href="/historial"
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Ver historial completo →
              </a>
            </div>

            {(!allInvoices || allInvoices.length === 0) ? (
              <div className="py-16 text-center">
                <span className="text-4xl mb-3">📄</span>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No hay facturas registradas</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Arrastra tus facturas en el módulo de Subir Factura para comenzar a procesarlas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                      {['Proveedor', 'Nº Factura', 'Fecha Emisión', 'Total', 'Estado', 'Fecha Registro'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {allInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs truncate">
                          {inv.vendor_name ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                          {inv.invoice_number ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs">
                          {inv.invoice_date ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-semibold">
                          {inv.total_amount != null ? formatCurrency(Number(inv.total_amount)) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-6 py-4 text-zinc-400 dark:text-zinc-500 text-xs whitespace-nowrap">
                          {formatDate(inv.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
