import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

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

  // ── Métricas en paralelo ─────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const [
    { data: products },
    { data: invoicesToday },
    { data: allInvoices },
  ] = await Promise.all([
    supabase.from('products').select('id, name, barcode, stock, unit_price, updated_at').order('updated_at', { ascending: false }),
    supabase.from('invoices').select('id').eq('status', 'processed').gte('created_at', todayIso),
    supabase.from('invoices').select('id, vendor_name, invoice_number, total_amount, status, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const totalProducts = products?.length ?? 0
  const totalStock = products?.reduce((acc, p) => acc + (p.stock ?? 0), 0) ?? 0
  const inventoryValue = products?.reduce((acc, p) => acc + (p.stock ?? 0) * (p.unit_price ?? 0), 0) ?? 0
  const processedToday = invoicesToday?.length ?? 0

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard de Inventario</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Vista general del estado del inventario y actividad reciente.
          </p>
        </div>

        {/* KPI Cards */}
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total de Productos"
              value={totalProducts.toLocaleString('es-MX')}
              icon="📦"
              accent="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            />
            <KpiCard
              label="Stock Total"
              value={totalStock.toLocaleString('es-MX')}
              sub="unidades en inventario"
              icon="🏭"
              accent="border-violet-200 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20"
            />
            <KpiCard
              label="Valor del Inventario"
              value={formatCurrency(inventoryValue)}
              icon="💰"
              accent="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            />
            <KpiCard
              label="Facturas Procesadas Hoy"
              value={processedToday}
              icon="✅"
              accent="border-cyan-200 bg-cyan-50/50 dark:border-cyan-900/50 dark:bg-cyan-950/20"
            />
          </div>
        </section>

        {/* Products Table */}
        <section>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                Maestro de Productos
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {totalProducts} producto{totalProducts !== 1 ? 's' : ''}
              </span>
            </div>
            {(!products || products.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sin productos en el inventario</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Los productos aparecerán aquí después de confirmar ítems en el módulo de Verificación.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      {['Nombre', 'Código de barras', 'Stock', 'Precio unitario', 'Última actualización'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs truncate">
                          {p.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                          {p.barcode ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </td>
                        <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-semibold">
                          {Number(p.stock).toLocaleString('es-MX')}
                        </td>
                        <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                          {formatCurrency(p.unit_price)}
                        </td>
                        <td className="px-6 py-4 text-zinc-400 dark:text-zinc-500 text-xs whitespace-nowrap">
                          {formatDate(p.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Recent Invoices */}
        <section>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                Facturas Recientes
              </h2>
              <a
                href="/historial"
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Ver todo →
              </a>
            </div>
            {(!allInvoices || allInvoices.length === 0) ? (
              <div className="py-12 text-center">
                <p className="text-sm text-zinc-400">No hay facturas registradas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      {['Proveedor', 'Nº Factura', 'Total', 'Estado', 'Fecha'].map((h) => (
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
                        <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                          {inv.total_amount != null ? formatCurrency(inv.total_amount) : '—'}
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
