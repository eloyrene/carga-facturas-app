# FacturasAI — Sistema Automatizado de Carga de Facturas

> Plataforma web que automatiza la extracción de datos de facturas (PDF/imagen) mediante **Gemini 3.6 Flash**, los persiste en **Supabase** y los orquesta con **n8n Workflows**.

---

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| **Backend / BD** | Supabase (PostgreSQL + Auth + Storage) |
| **IA** | Google Gemini 3.6 Flash (REST v1beta) |
| **Automatización** | n8n Workflow (Webhook → IA → Supabase) |
| **Deploy** | Vercel |

---

## 📂 Estructura del Proyecto

```
src/
├── app/
│   ├── page.tsx                  # Pantalla principal – Subir Factura (Dropzone)
│   ├── dashboard/page.tsx        # Dashboard de métricas de facturas
│   ├── productos/page.tsx        # Catálogo consolidado de productos
│   ├── historial/page.tsx        # Historial de facturas procesadas
│   └── api/
│       ├── invoices/[id]/confirm # Endpoint de confirmación manual de ítems
│       └── webhooks/
│           ├── n8n-callback/     # Callback que recibe el resultado de n8n
│           └── process-invoice/  # Disparo del pipeline de procesamiento
├── components/
│   ├── AppShell.tsx              # Layout principal con Sidebar
│   ├── Sidebar.tsx               # Barra de navegación lateral
│   ├── InvoiceDropzone.tsx       # Zona de carga de facturas drag-and-drop
│   ├── InvoiceReviewForm.tsx     # Formulario de revisión manual split-screen
│   └── InvoiceHistoryClient.tsx  # Tabla interactiva del historial
└── lib/
    ├── supabase/
    │   ├── client.ts             # Cliente Supabase para el navegador
    │   ├── server.ts             # Cliente Supabase para Server Components
    │   └── types.ts              # Tipos TypeScript del esquema de BD
    └── hooks/
        └── useTheme.ts           # Hook de alternancia Dark/Light Mode
supabase/
└── schema.sql                    # Esquema SQL completo de la base de datos
```

---

## ⚙️ Configuración Local

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/carga-facturas-app.git
cd carga-facturas-app
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea el archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY

# n8n Webhook (URL pública de tu instancia de n8n)
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://TU_N8N/webhook/cargar-factura

# Secreto compartido para el callback de n8n (opcional pero recomendado)
N8N_CALLBACK_SECRET=un_secreto_seguro
```

### 4. Inicializar la base de datos

Ejecuta el SQL del archivo [`supabase/schema.sql`](./supabase/schema.sql) en el **SQL Editor** de tu proyecto de Supabase para crear las tablas `profiles`, `invoices`, `invoice_items` y `products`.

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🗄️ Esquema de Base de Datos

```
auth.users ──1:1──▶ profiles
profiles   ──1:N──▶ invoices
profiles   ──1:N──▶ products
invoices   ──1:N──▶ invoice_items
```

| Tabla | Descripción |
|---|---|
| `profiles` | Perfil de usuario vinculado a Supabase Auth |
| `invoices` | Cabecera de cada factura subida (proveedor, fecha, total, estado) |
| `invoice_items` | Ítems/renglones extraídos por la IA de cada factura |
| `products` | Catálogo consolidado de productos confirmados |

---

## 🤖 Flujo de Automatización (n8n)

```
[Webhook] → [Code: Binary → Base64] → [HTTP: Gemini 3.6 Flash]
         → [Code: Parseo JSON]       → [HTTP: PATCH invoices]
         → [Code: Mapeo ítems]       → [HTTP: POST invoice_items]
         → [Respond to Webhook]
```

El frontend envía el archivo como `multipart/form-data` al webhook de n8n junto con el `invoiceId` y `userId`. n8n convierte el archivo a Base64, lo envía a la API de Gemini y persiste los resultados en Supabase.

---

## 🌐 Deploy en Vercel

1. Sube tu código a GitHub.
2. Importa el repositorio en [vercel.com](https://vercel.com).
3. Agrega las mismas variables de entorno del paso 3 en **Settings → Environment Variables**.
4. Haz clic en **Deploy**.

> **Nota**: Si tu n8n está en local, usa [ngrok](https://ngrok.com) o despliégalo en la nube (n8n Cloud, Render, Railway) para que Vercel pueda alcanzarlo.

---

## 📄 Licencia

Proyecto académico desarrollado con Next.js, Supabase y Google Gemini.
