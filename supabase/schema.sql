-- ============================================================
-- PROYECTO 4: Sistema de Gestión de Inventario y Facturas
-- Script SQL – Fase 1
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
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number  TEXT,
  vendor_name     TEXT,
  total_amount    NUMERIC(12, 2),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processed', 'error')),
  raw_json        JSONB,
  file_url        TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices frecuentes
CREATE INDEX IF NOT EXISTS invoices_user_id_idx  ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx   ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_created_idx  ON public.invoices (created_at DESC);

-- ----------------------------------------------------------------
-- 3. TABLA: inventory_items
--    Ítems extraídos de cada factura (1 factura → N ítems)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  quantity     NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price  NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sku          TEXT
);

CREATE INDEX IF NOT EXISTS inventory_items_invoice_idx ON public.inventory_items (invoice_id);
CREATE INDEX IF NOT EXISTS inventory_items_sku_idx     ON public.inventory_items (sku);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- ----------------------------------------------------------------
-- RLS: profiles
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven y editan su propio perfil
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

-- Usuarios ven solo sus facturas
CREATE POLICY "invoices: select own"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios crean facturas solo para sí mismos
CREATE POLICY "invoices: insert own"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuarios actualizan solo sus facturas
CREATE POLICY "invoices: update own"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuarios eliminan solo sus facturas
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
-- RLS: inventory_items
-- ----------------------------------------------------------------
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Usuarios ven ítems de sus propias facturas
CREATE POLICY "inventory_items: select own"
  ON public.inventory_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

-- Usuarios insertan ítems en sus propias facturas
CREATE POLICY "inventory_items: insert own"
  ON public.inventory_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

-- Usuarios actualizan ítems de sus facturas
CREATE POLICY "inventory_items: update own"
  ON public.inventory_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

-- Usuarios eliminan ítems de sus facturas
CREATE POLICY "inventory_items: delete own"
  ON public.inventory_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

-- Admins tienen acceso completo
CREATE POLICY "inventory_items: admin full access"
  ON public.inventory_items FOR ALL
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

-- Activar el trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- STORAGE: Bucket para facturas
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff']
)
ON CONFLICT (id) DO NOTHING;

-- Política de Storage: usuarios suben a su propia carpeta (userId/filename)
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
