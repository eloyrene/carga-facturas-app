-- ============================================================
-- PROYECTO 4: Sistema de Gestión de Inventario y Facturas
-- Script SQL – Fase 2 (Migración completa)
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- ----------------------------------------------------------------
-- 1. TABLA: profiles
--    Extiende auth.users con rol y metadata de negocio
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin', 'user')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- ----------------------------------------------------------------
-- 2. TABLA: invoices
--    Almacena las facturas subidas por los usuarios
--    Cambios v2:
--      - status amplía valores a: pending, processed, needs_review, failed
--      - Nuevas columnas: invoice_date, confidence_score
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number   TEXT,
  vendor_name      TEXT,
  invoice_date     DATE,
  total_amount     NUMERIC(12, 2),
  confidence_score NUMERIC(4, 3),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processed', 'needs_review', 'failed')),
  raw_json         JSONB,
  file_url         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices frecuentes
CREATE INDEX IF NOT EXISTS invoices_user_id_idx  ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx   ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_created_idx  ON public.invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_vendor_idx   ON public.invoices (vendor_name);

-- ----------------------------------------------------------------
-- 3. TABLA: invoice_items
--    Ítems extraídos por la IA de cada factura (1 factura → N ítems)
--    NOTA: Esta tabla reemplaza a "inventory_items" del esquema v1.
--    Si tienes la tabla antigua, ejecuta PRIMERO:
--      ALTER TABLE public.inventory_items RENAME TO invoice_items;
--      ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS extracted_name TEXT;
--      ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS barcode TEXT;
--    Si la DB está vacía, simplemente usa este CREATE TABLE directamente.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  extracted_name TEXT NOT NULL,
  barcode        TEXT,
  quantity       NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price    NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  -- Campos de edición manual (módulo de verificación humana)
  confirmed_name TEXT,
  is_confirmed   BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_barcode_idx ON public.invoice_items (barcode);

-- ----------------------------------------------------------------
-- 4. TABLA: products
--    Maestro de catálogo/inventario (datos confirmados por el usuario)
--    El campo barcode es el identificador único de cada producto.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  barcode        TEXT,
  stock          NUMERIC(10, 3) NOT NULL DEFAULT 0,
  unit_price     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE por barcode dentro del mismo usuario
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_user_idx
  ON public.products (user_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_user_id_idx ON public.products (user_id);
CREATE INDEX IF NOT EXISTS products_name_idx    ON public.products (name);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- ----------------------------------------------------------------
-- RLS: profiles
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "profiles: admin select all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- RLS: invoices
-- ----------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices: select own"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "invoices: insert own"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices: update own"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices: delete own"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Admins tienen acceso completo
CREATE POLICY "invoices: admin full access"
  ON public.invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- RLS: invoice_items
-- ----------------------------------------------------------------
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items: select own"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: insert own"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: update own"
  ON public.invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: delete own"
  ON public.invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: admin full access"
  ON public.invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- RLS: products
-- ----------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products: select own"
  ON public.products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "products: insert own"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products: update own"
  ON public.products FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products: delete own"
  ON public.products FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "products: admin full access"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ================================================================
-- TRIGGER: Auto-crear perfil al registrar un usuario
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- TRIGGER: Actualizar updated_at en products
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- STORAGE: Bucket para facturas
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

CREATE POLICY "storage: users upload own invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage: users read own invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage: users delete own invoices"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
