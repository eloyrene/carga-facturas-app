import type { Metadata } from 'next'
import AppShell from '@/components/AppShell'
import InvoiceDropzone from '@/components/InvoiceDropzone'

export const metadata: Metadata = {
  title: 'Subir Factura',
  description:
    'Sube tus facturas en PDF o imagen y extrae los datos automáticamente con Gemini IA.',
}

export default function HomePage() {
  return (
    <AppShell>
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400">
            ✦ Procesamiento con Gemini 2.5 Flash
          </span>
          <h1 className="mt-3 bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            Cargar Factura
          </h1>
          <p className="mt-4 max-w-sm text-base text-zinc-500 dark:text-zinc-400">
            Arrastra tus facturas y extrae automáticamente proveedores, totales
            e ítems de inventario.
          </p>
        </div>

        {/* Dropzone */}
        <InvoiceDropzone />

        {/* Features */}
        <div className="mt-14 grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:gap-6 max-w-2xl w-full">
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
              className="rounded-2xl border border-zinc-200/80 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.03] p-5 backdrop-blur-sm"
            >
              <span className="text-2xl">{icon}</span>
              <h2 className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
