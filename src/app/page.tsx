import type { Metadata } from 'next'
import InvoiceDropzone from '@/components/InvoiceDropzone'

export const metadata: Metadata = {
  title: 'Sistema de Gestión de Facturas',
  description:
    'Sube tus facturas en PDF o imagen y extrae los datos automáticamente con IA.',
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 px-4 py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
          ✦ Procesamiento con IA
        </span>
        <h1 className="mt-3 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Gestión de Facturas
        </h1>
        <p className="mt-4 max-w-sm text-base text-zinc-400">
          Arrastra tus facturas y extrae automáticamente proveedores, totales e
          ítems de inventario.
        </p>
      </div>

      {/* Dropzone */}
      <InvoiceDropzone />

      {/* Features */}
      <div className="mt-14 grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:gap-6">
        {[
          {
            icon: '📄',
            title: 'OCR + IA',
            desc: 'Extrae datos de facturas PDF e imágenes automáticamente.',
          },
          {
            icon: '🔒',
            title: 'Privado y seguro',
            desc: 'Cada factura es accesible solo por tu cuenta.',
          },
          {
            icon: '📦',
            title: 'Inventario automático',
            desc: 'Los ítems detectados se agregan a tu inventario.',
          },
        ].map(({ icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm"
          >
            <span className="text-2xl">{icon}</span>
            <h2 className="mt-2 text-sm font-semibold text-zinc-200">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
