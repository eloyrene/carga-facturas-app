'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { InvoiceForReview } from '@/app/verificacion/page'
import type { InvoiceItem } from '@/lib/supabase/types'

function formatCurrency(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function ConfidenceChip({ score }: { score: number | null }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = score >= 0.8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
    : score >= 0.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      🤖 Confianza: {pct}%
    </span>
  )
}

// ── Editable Item Row ──────────────────────────────────────────────
interface EditableItemRowProps {
  item: InvoiceItem
  onChange: (updated: Partial<InvoiceItem>) => void
}

function EditableItemRow({ item, onChange }: EditableItemRowProps) {
  const inputCls = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition'

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 px-4">
        <input
          type="text"
          defaultValue={item.confirmed_name ?? item.extracted_name}
          onChange={(e) => onChange({ confirmed_name: e.target.value })}
          className={inputCls}
          placeholder="Nombre del producto"
        />
        {item.confirmed_name && item.confirmed_name !== item.extracted_name && (
          <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
            Original: {item.extracted_name}
          </p>
        )}
      </td>
      <td className="py-3 px-4">
        <input
          type="text"
          defaultValue={item.barcode ?? ''}
          onChange={(e) => onChange({ barcode: e.target.value || null })}
          className={`${inputCls} font-mono text-xs`}
          placeholder="—"
        />
      </td>
      <td className="py-3 px-4">
        <input
          type="number"
          min="0"
          step="0.001"
          defaultValue={item.quantity}
          onChange={(e) => onChange({ quantity: parseFloat(e.target.value) || 0 })}
          className={`${inputCls} text-right w-24`}
        />
      </td>
      <td className="py-3 px-4">
        <input
          type="number"
          min="0"
          step="0.01"
          defaultValue={item.unit_price}
          onChange={(e) => onChange({ unit_price: parseFloat(e.target.value) || 0 })}
          className={`${inputCls} text-right w-28`}
        />
      </td>
      <td className="py-3 px-4 text-right text-sm font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
        {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
      </td>
    </tr>
  )
}

import InvoiceReviewForm from '@/components/InvoiceReviewForm'

// ── Main Client Component ──────────────────────────────────────────
interface Props {
  invoices: InvoiceForReview[]
}

export default function VerificationClient({ invoices }: Props) {
  const [remaining, setRemaining] = useState<InvoiceForReview[]>(invoices)

  const handleConfirmed = (invoiceId: string) => {
    setRemaining((prev) => prev.filter((inv) => inv.id !== invoiceId))
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Verificación Humana</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Facturas del día de hoy que requieren revisión manual antes de insertarse en el inventario.
        </p>
      </div>

      {/* Stat */}
      {remaining.length > 0 && (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          ⚠ {remaining.length} factura{remaining.length !== 1 ? 's' : ''} pendiente{remaining.length !== 1 ? 's' : ''} de revisión
        </div>
      )}

      {/* Empty state */}
      {remaining.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-24 text-center">
          <span className="text-5xl mb-4">✅</span>
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
            Todo al día
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
            No hay facturas pendientes de verificación para el día de hoy.
          </p>
        </div>
      )}

      {/* Invoice Cards */}
      <div className="space-y-6">
        {remaining.map((invoice) => (
          <InvoiceReviewForm
            key={invoice.id}
            invoice={invoice}
            onSaveSuccess={(id) => {
              toast.success('Factura confirmada e insertada en inventario')
              handleConfirmed(id)
            }}
            onCancel={() => {
              // Simplemente podemos recargar o ignorar localmente si el usuario cancela la vista
              toast.info('Revisión cancelada')
            }}
          />
        ))}
      </div>
    </div>
  )
}
