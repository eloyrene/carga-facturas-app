import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import ToasterProvider from '@/components/ToasterProvider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'FacturasAI — Gestión Inteligente de Facturas',
    template: '%s | FacturasAI',
  },
  description:
    'Sistema inteligente de gestión de inventario y facturas con extracción automática mediante IA.',
  keywords: ['facturas', 'inventario', 'OCR', 'IA', 'gestión', 'Gemini'],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Script inline para evitar flash de tema incorrecto */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('app-theme');
                if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.documentElement.classList.toggle('dark', t === 'dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
        {children}
        <ToasterProvider />
      </body>
    </html>
  )
}
