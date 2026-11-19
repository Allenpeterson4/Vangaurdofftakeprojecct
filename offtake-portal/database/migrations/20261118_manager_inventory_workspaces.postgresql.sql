-- Adds manager workspace memberships and manager-owned product inventory.
-- Existing allocation rows retain their legacy accounting model.

BEGIN;

CREATE TABLE IF NOT EXISTS public.offtake_v2_manager_suppliers (
  manager_id UUID NOT NULL REFERENCES public.offtake_v2_managers(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.offtake_v2_suppliers(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (manager_id, supplier_id)
);
CREATE INDEX IF NOT EXISTS offtake_v2_manager_suppliers_supplier_idx
  ON public.offtake_v2_manager_suppliers (supplier_id, manager_id);
ALTER TABLE public.offtake_v2_manager_suppliers ENABLE ROW LEVEL SECURITY;

INSERT INTO public.offtake_v2_manager_suppliers (manager_id, supplier_id)
SELECT id, supplier_id
FROM public.offtake_v2_managers
WHERE supplier_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.offtake_v2_batches
  ADD COLUMN IF NOT EXISTS accounting_model VARCHAR(16) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(160) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS initial_purchase_amount NUMERIC(24,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_supply_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_allowance_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS discounted_revenue NUMERIC(24,2)
    GENERATED ALWAYS AS (
      ROUND(unit_quantity * wholesale_supply_price * (100 - sales_discount_percent) / 100, 2)
    ) STORED,
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(24,2)
    GENERATED ALWAYS AS (
      ROUND(unit_quantity * wholesale_supply_price * (100 - sales_discount_percent) / 100, 2)
      - initial_purchase_amount
    ) STORED,
  ADD COLUMN IF NOT EXISTS manager_allowance_amount NUMERIC(24,2)
    GENERATED ALWAYS AS (
      ROUND(
        GREATEST(
          ROUND(unit_quantity * wholesale_supply_price * (100 - sales_discount_percent) / 100, 2)
            - initial_purchase_amount,
          0
        ) * manager_allowance_percent / 100,
        2
      )
    ) STORED,
  ADD COLUMN IF NOT EXISTS net_company_payout NUMERIC(24,2)
    GENERATED ALWAYS AS (
      GREATEST(
        initial_purchase_amount
          + ROUND(unit_quantity * wholesale_supply_price * (100 - sales_discount_percent) / 100, 2)
          - ROUND(
            GREATEST(
              ROUND(unit_quantity * wholesale_supply_price * (100 - sales_discount_percent) / 100, 2)
                - initial_purchase_amount,
              0
            ) * manager_allowance_percent / 100,
            2
          ),
        0
      )
    ) STORED;

ALTER TABLE public.offtake_v2_batches
  ADD CONSTRAINT offtake_v2_batches_accounting_model_check
    CHECK (accounting_model IN ('legacy', 'inventory')),
  ADD CONSTRAINT offtake_v2_batches_product_name_check
    CHECK (CHAR_LENGTH(BTRIM(product_name)) <= 160),
  ADD CONSTRAINT offtake_v2_batches_purchase_amount_check
    CHECK (initial_purchase_amount >= 0),
  ADD CONSTRAINT offtake_v2_batches_discount_check
    CHECK (sales_discount_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT offtake_v2_batches_wholesale_price_check
    CHECK (wholesale_supply_price >= 0),
  ADD CONSTRAINT offtake_v2_batches_allowance_percent_check
    CHECK (manager_allowance_percent BETWEEN 0 AND 100);

ALTER TABLE public.offtake_v2_batches
  DROP CONSTRAINT IF EXISTS offtake_v2_batches_status_check;
ALTER TABLE public.offtake_v2_batches
  ADD CONSTRAINT offtake_v2_batches_status_check
    CHECK (status IN ('pending', 'paid', 'in_transit', 'completed', 'disputed'));

ALTER TABLE public.offtake_v2_status_audit
  DROP CONSTRAINT IF EXISTS offtake_v2_status_audit_old_status_check;
ALTER TABLE public.offtake_v2_status_audit
  DROP CONSTRAINT IF EXISTS offtake_v2_status_audit_new_status_check;
ALTER TABLE public.offtake_v2_status_audit
  ADD CONSTRAINT offtake_v2_status_audit_old_status_check
    CHECK (old_status IS NULL OR old_status IN ('pending', 'paid', 'in_transit', 'completed', 'disputed')),
  ADD CONSTRAINT offtake_v2_status_audit_new_status_check
    CHECK (new_status IN ('pending', 'paid', 'in_transit', 'completed', 'disputed'));

CREATE OR REPLACE FUNCTION public.offtake_v2_can_access_supplier(p_supplier_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.offtake_v2_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.offtake_v2_manager_suppliers AS membership
      JOIN public.offtake_v2_managers AS manager ON manager.id = membership.manager_id
      WHERE membership.manager_id = auth.uid()
        AND membership.supplier_id = p_supplier_id
        AND manager.is_active
    )
    OR EXISTS (
      SELECT 1
      FROM public.offtake_v2_managers AS manager
      WHERE manager.id = auth.uid()
        AND manager.is_active
        AND manager.supplier_id = p_supplier_id
    );
$$;

CREATE OR REPLACE FUNCTION public.offtake_v2_can_access_batch(p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.offtake_v2_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.offtake_v2_batches
      WHERE id = p_batch_id
        AND public.offtake_v2_can_access_supplier(supplier_id)
    );
$$;

DROP POLICY IF EXISTS offtake_v2_manager_suppliers_select ON public.offtake_v2_manager_suppliers;
CREATE POLICY offtake_v2_manager_suppliers_select ON public.offtake_v2_manager_suppliers
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.offtake_v2_is_admin());

DROP POLICY IF EXISTS offtake_v2_suppliers_select ON public.offtake_v2_suppliers;
CREATE POLICY offtake_v2_suppliers_select ON public.offtake_v2_suppliers
  FOR SELECT TO authenticated
  USING (public.offtake_v2_is_admin() OR public.offtake_v2_can_access_supplier(id));

DROP POLICY IF EXISTS offtake_v2_batches_select ON public.offtake_v2_batches;
CREATE POLICY offtake_v2_batches_select ON public.offtake_v2_batches
  FOR SELECT TO authenticated
  USING (public.offtake_v2_is_admin() OR public.offtake_v2_can_access_supplier(supplier_id));

DROP POLICY IF EXISTS offtake_v2_batches_insert ON public.offtake_v2_batches;
CREATE POLICY offtake_v2_batches_insert ON public.offtake_v2_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.offtake_v2_is_admin() AND accounting_model IN ('legacy', 'inventory'))
    OR (
      public.offtake_v2_can_access_supplier(supplier_id)
      AND accounting_model = 'inventory'
      AND status = 'pending'
    )
  );

DROP POLICY IF EXISTS offtake_v2_batches_update ON public.offtake_v2_batches;
CREATE POLICY offtake_v2_batches_update ON public.offtake_v2_batches
  FOR UPDATE TO authenticated
  USING (public.offtake_v2_is_admin() OR public.offtake_v2_can_access_supplier(supplier_id))
  WITH CHECK (public.offtake_v2_is_admin() OR public.offtake_v2_can_access_supplier(supplier_id));

CREATE OR REPLACE FUNCTION public.offtake_v2_validate_batch_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_allowed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR (
      NOT public.offtake_v2_is_admin()
      AND (
        NEW.accounting_model <> 'inventory'
        OR NOT public.offtake_v2_can_access_supplier(NEW.supplier_id)
      )
    ) THEN
      RAISE EXCEPTION 'This account cannot create the requested batch.' USING ERRCODE = '42501';
    END IF;
    NEW.dispatched_at := NULL;
    NEW.completed_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.offtake_v2_is_admin();
  IF v_is_admin THEN
    v_allowed :=
      (OLD.status = 'pending' AND NEW.status IN ('paid', 'in_transit', 'disputed'))
      OR (OLD.status = 'paid' AND NEW.status IN ('in_transit', 'disputed'))
      OR (OLD.status = 'in_transit' AND NEW.status IN ('completed', 'disputed'))
      OR (OLD.status = 'disputed' AND NEW.status IN ('pending', 'paid', 'in_transit'));
  ELSE
    v_allowed := public.offtake_v2_can_access_supplier(OLD.supplier_id)
      AND ((OLD.status = 'pending' AND NEW.status = 'paid')
        OR (OLD.status = 'paid' AND NEW.status = 'in_transit')
        OR (OLD.status = 'in_transit' AND NEW.status = 'completed'));
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'This batch status transition is not allowed.' USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := now();
  IF NEW.status = 'in_transit' THEN
    NEW.dispatched_at := now();
  ELSIF NEW.status IN ('pending', 'paid') THEN
    NEW.dispatched_at := NULL;
  END IF;
  IF NEW.status = 'completed' THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.offtake_v2_guard_batch_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF public.offtake_v2_is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
    OR NEW.accounting_model IS DISTINCT FROM OLD.accounting_model THEN
    RAISE EXCEPTION 'This batch is not accessible to this manager.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'pending'
    AND OLD.status = 'pending'
    AND NEW.accounting_model = 'inventory'
    AND public.offtake_v2_can_access_supplier(OLD.supplier_id) THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF ROW(
      NEW.product_name,
      NEW.unit_quantity,
      NEW.initial_purchase_amount,
      NEW.sales_discount_percent,
      NEW.wholesale_supply_price,
      NEW.manager_allowance_percent,
      NEW.destination_route,
      NEW.vehicle_reference,
      NEW.driver_name,
      NEW.driver_phone
    ) IS DISTINCT FROM ROW(
      OLD.product_name,
      OLD.unit_quantity,
      OLD.initial_purchase_amount,
      OLD.sales_discount_percent,
      OLD.wholesale_supply_price,
      OLD.manager_allowance_percent,
      OLD.destination_route,
      OLD.vehicle_reference,
      OLD.driver_name,
      OLD.driver_phone
    ) THEN
    RAISE EXCEPTION 'Product details can only be edited before the batch is funded.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offtake_v2_batch_edit_guard ON public.offtake_v2_batches;
CREATE TRIGGER offtake_v2_batch_edit_guard
BEFORE UPDATE ON public.offtake_v2_batches
FOR EACH ROW EXECUTE FUNCTION public.offtake_v2_guard_batch_edit();

CREATE OR REPLACE FUNCTION public.offtake_v2_record_weekly_payout(
  p_supplier_id UUID,
  p_week_start DATE,
  p_transfer_reference TEXT DEFAULT ''
)
RETURNS TABLE (id BIGINT, amount NUMERIC, paid_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_paid_by_email TEXT;
  v_credited NUMERIC(24,2);
  v_paid NUMERIC(24,2);
  v_outstanding NUMERIC(24,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.offtake_v2_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_week_start IS NULL
    OR EXTRACT(ISODOW FROM p_week_start) <> 1
    OR p_week_start > date_trunc('week', now() AT TIME ZONE 'UTC')::DATE THEN
    RAISE EXCEPTION 'Choose a completed Monday settlement week.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.offtake_v2_suppliers WHERE id = p_supplier_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchasing company not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM(
      CASE WHEN b.accounting_model = 'inventory'
        THEN b.net_company_payout
        ELSE b.net_investor_credit
      END
    ), 0)
    INTO v_credited
    FROM public.offtake_v2_batches AS b
    WHERE b.supplier_id = p_supplier_id
      AND b.status = 'completed'
      AND b.completed_at >= (p_week_start::TIMESTAMP AT TIME ZONE 'UTC')
      AND b.completed_at < ((p_week_start + 7)::TIMESTAMP AT TIME ZONE 'UTC');
  SELECT COALESCE(SUM(p.amount), 0)
    INTO v_paid
    FROM public.offtake_v2_weekly_payouts AS p
    WHERE p.supplier_id = p_supplier_id AND p.week_start = p_week_start;
  v_outstanding := v_credited - v_paid;
  IF v_outstanding <= 0 THEN
    RAISE EXCEPTION 'There is no outstanding payout for this purchasing company and week.' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.email INTO v_paid_by_email FROM auth.users AS u WHERE u.id = auth.uid();
  RETURN QUERY
  INSERT INTO public.offtake_v2_weekly_payouts AS payout (
    supplier_id, week_start, amount, paid_by_admin_id, paid_by_email, transfer_reference
  ) VALUES (
    p_supplier_id,
    p_week_start,
    v_outstanding,
    auth.uid(),
    COALESCE(v_paid_by_email, ''),
    LEFT(BTRIM(COALESCE(p_transfer_reference, '')), 120)
  )
  RETURNING payout.id, payout.amount, payout.paid_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.offtake_v2_assign_manager_workspaces(
  p_manager_id UUID,
  p_supplier_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_supplier_ids UUID[] := COALESCE(p_supplier_ids, ARRAY[]::UUID[]);
  v_primary_supplier UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.offtake_v2_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.offtake_v2_managers WHERE id = p_manager_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manager account not found.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(v_supplier_ids) AS requested(id)
    LEFT JOIN public.offtake_v2_suppliers AS supplier ON supplier.id = requested.id
    WHERE supplier.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected purchasing company does not exist.' USING ERRCODE = '23503';
  END IF;

  SELECT id INTO v_primary_supplier
  FROM unnest(v_supplier_ids) WITH ORDINALITY AS selected(id, position)
  ORDER BY position
  LIMIT 1;

  UPDATE public.offtake_v2_managers
  SET supplier_id = v_primary_supplier, updated_at = now()
  WHERE id = p_manager_id;
  DELETE FROM public.offtake_v2_manager_suppliers WHERE manager_id = p_manager_id;
  INSERT INTO public.offtake_v2_manager_suppliers (manager_id, supplier_id)
  SELECT p_manager_id, selected.id
  FROM unnest(v_supplier_ids) AS selected(id)
  ON CONFLICT DO NOTHING;
  RETURN v_primary_supplier;
END;
$$;

CREATE OR REPLACE FUNCTION public.offtake_v2_create_manager_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_company_name TEXT;
  v_supplier_id UUID;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  v_full_name := LEFT(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), 160);
  IF CHAR_LENGTH(v_full_name) < 2 THEN
    v_full_name := LEFT(COALESCE(NULLIF(SPLIT_PART(NEW.email, '@', 1), ''), 'Manager'), 160);
    IF CHAR_LENGTH(v_full_name) < 2 THEN
      v_full_name := 'Manager';
    END IF;
  END IF;
  v_company_name := BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'company_name', ''));
  IF v_company_name = '' THEN
    INSERT INTO public.offtake_v2_managers (id, email, full_name)
    VALUES (NEW.id, NEW.email, v_full_name)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;
  IF CHAR_LENGTH(v_company_name) < 2 OR CHAR_LENGTH(v_company_name) > 160 THEN
    RAISE EXCEPTION 'A company name between 2 and 160 characters is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.offtake_v2_suppliers (name, contact_person)
  VALUES (v_company_name, v_full_name)
  RETURNING id INTO v_supplier_id;
  INSERT INTO public.offtake_v2_managers (id, email, full_name, supplier_id)
  VALUES (NEW.id, NEW.email, v_full_name, v_supplier_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.offtake_v2_manager_suppliers (manager_id, supplier_id)
  VALUES (NEW.id, v_supplier_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE public.offtake_v2_manager_suppliers FROM anon, authenticated;
GRANT SELECT ON public.offtake_v2_manager_suppliers TO anon, authenticated;
GRANT INSERT ON public.offtake_v2_batches TO authenticated;
GRANT UPDATE (
  status,
  product_name,
  unit_quantity,
  initial_purchase_amount,
  sales_discount_percent,
  wholesale_supply_price,
  manager_allowance_percent,
  destination_route,
  vehicle_reference,
  driver_name,
  driver_phone
) ON public.offtake_v2_batches TO authenticated;
REVOKE ALL ON FUNCTION public.offtake_v2_can_access_supplier(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offtake_v2_can_access_supplier(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.offtake_v2_guard_batch_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offtake_v2_assign_manager_workspaces(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offtake_v2_assign_manager_workspaces(UUID, UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.offtake_v2_create_manager_profile() FROM PUBLIC, anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
