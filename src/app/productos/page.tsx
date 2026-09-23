import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Catálogo de Productos',
  description: 'Listado de productos extraídos con cantidades y precios.',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

export default async function ProductosPage() {
  const supabase = await createClient()

  // Traer los ítems extraídos de las facturas
  const { data: rawItems, error: itemsError } = await supabase
    .from('invoice_items')
    .select('id, extracted_name, confirmed_name, barcode, quantity, unit_price, total_price, invoice_id, is_confirmed')
    .order('invoice_id', { ascending: false })

  if (itemsError) {
    console.error('[ProductosPage] Error al cargar items:', itemsError.message)
  }

  const items = rawItems || []

  // Calcular métricas
  const totalDistinctProducts = new Set(items.map((i) => i.confirmed_name || i.extracted_name)).size
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  const totalValue = items.reduce(
    (sum, item) => sum + (Number(item.total_price) || Number(item.quantity || 0) * Number(item.unit_price || 0)),
    0,
  )

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Encabezado */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Catálogo de Productos</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Consulta los productos registrados a partir de tus facturas, sus cantidades y sus precios.
          </p>
        </div>

        {/* Tarjetas KPI de Productos */}
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Productos Distintos</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{totalDistinctProducts}</p>
                </div>
                <span className="text-3xl">📦</span>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Unidades Totales</p>
                  <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{totalUnits.toLocaleString('es-MX')}</p>
                  <p className="mt-1 text-xs text-zinc-500">suma de cantidades</p>
                </div>
                <span className="text-3xl">🏭</span>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Valor Acumulado</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalValue)}</p>
                </div>
                <span className="text-3xl">💰</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tabla de Productos */}
        <section>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                Lista de Productos Registrados
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {items.length} registro{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">📦</span>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No hay productos registrados</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Sube tus facturas y procésalas con la IA para ver aquí los productos extraídos.
                </p>
                {itemsError && (
                  <p className="text-xs text-rose-500 mt-2 font-mono">{itemsError.message}</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Cód. Barras / SKU
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Cantidad (Unidades)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Precio Unitario
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Precio Total
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {items.map((item) => {
                      const name = item.confirmed_name || item.extracted_name
                      const total = item.total_price || item.quantity * item.unit_price
                      return (
                        <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs">
                            <p className="truncate">{name}</p>
                            {item.confirmed_name && item.confirmed_name !== item.extracted_name && (
                              <p className="text-[10px] text-zinc-400 truncate">Original: {item.extracted_name}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                            {item.barcode ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                            {Number(item.quantity).toLocaleString('es-MX')}
                          </td>
                          <td className="px-6 py-4 text-right text-zinc-700 dark:text-zinc-300">
                            {formatCurrency(Number(item.unit_price))}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(Number(total))}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.is_confirmed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                Confirmado
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                Pendiente
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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
