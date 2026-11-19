-- Correct the inventory payout to return recovered capital plus net profit.

BEGIN;

ALTER TABLE public.offtake_v2_batches
  DROP COLUMN IF EXISTS net_company_payout;

ALTER TABLE public.offtake_v2_batches
  ADD COLUMN net_company_payout NUMERIC(24,2)
    GENERATED ALWAYS AS (
      GREATEST(
        ROUND(unit_quantity * wholesale_supply_price * (100 - sales_discount_percent) / 100, 2)
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

COMMIT;
NOTIFY pgrst, 'reload schema';
