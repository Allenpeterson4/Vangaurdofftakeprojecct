-- Apply once to an existing Supabase installation to give each new manager
-- signup a private supplier row and immediate company assignment.
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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.offtake_v2_create_manager_profile() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
