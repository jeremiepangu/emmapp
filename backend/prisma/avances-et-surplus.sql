-- Trop-percu porte en avance sur compte et imputation des versements par commande.

-- 1. Enum d'origine d'une imputation
DO $$ BEGIN
  CREATE TYPE "PaymentAllocationSource" AS ENUM ('PAIEMENT', 'AVANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Avance sur compte du client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advance_balance numeric(12, 2) NOT NULL DEFAULT 0;

-- 3. Imputations des versements sur les commandes
CREATE TABLE IF NOT EXISTS payment_allocations (
  id         text PRIMARY KEY,
  payment_id text REFERENCES payments(id) ON DELETE CASCADE,
  order_id   text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount     numeric(12, 2) NOT NULL,
  source     "PaymentAllocationSource" NOT NULL DEFAULT 'PAIEMENT',
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS payment_allocations_order_id_idx ON payment_allocations(order_id);
CREATE INDEX IF NOT EXISTS payment_allocations_payment_id_idx ON payment_allocations(payment_id);

-- 4. Reprise des versements existants
-- Chaque versement rattache a une commande, directement ou via sa livraison,
-- est impute dans l'ordre chronologique sans depasser le total de la commande.
INSERT INTO payment_allocations (id, payment_id, order_id, amount, source, created_at)
SELECT
  gen_random_uuid()::text,
  r.payment_id,
  r.order_id,
  r.allocated,
  'PAIEMENT',
  r.created_at
FROM (
  SELECT
    e.payment_id,
    e.order_id,
    e.created_at,
    LEAST(
      e.amount,
      GREATEST(0, e.total_amount - COALESCE(SUM(e.amount) OVER (
        PARTITION BY e.order_id ORDER BY e.created_at, e.payment_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0))
    ) AS allocated
  FROM (
    SELECT
      p.id AS payment_id,
      COALESCE(p.order_id, d.order_id) AS order_id,
      p.amount,
      p.created_at,
      o.total_amount
    FROM payments p
    LEFT JOIN deliveries d ON d.id = p.delivery_id
    JOIN orders o ON o.id = COALESCE(p.order_id, d.order_id)
  ) e
) r
WHERE r.allocated > 0
  AND NOT EXISTS (
    SELECT 1 FROM payment_allocations a WHERE a.payment_id = r.payment_id
  );

-- 5. Le cumul verse d'une commande devient la somme de ses imputations.
UPDATE orders o
SET paid_amount = COALESCE((
  SELECT SUM(a.amount) FROM payment_allocations a WHERE a.order_id = o.id
), 0);

UPDATE orders
SET payment_status = CASE
  WHEN paid_amount <= 0 THEN 'IMPAYEE'::"OrderPaymentStatus"
  WHEN total_amount - paid_amount <= 0.01 THEN 'SOLDEE'::"OrderPaymentStatus"
  ELSE 'PARTIELLE'::"OrderPaymentStatus"
END;

-- 6. Ce qui a ete encaisse sans pouvoir etre impute constitue l'avance du client.
UPDATE clients c
SET advance_balance = GREATEST(0, COALESCE((
  SELECT SUM(p.amount) FROM payments p WHERE p.client_id = c.id
), 0) - COALESCE((
  SELECT SUM(a.amount)
  FROM payment_allocations a
  JOIN payments p ON p.id = a.payment_id
  WHERE p.client_id = c.id
), 0));

-- 7. La dette en argent reste la somme des restes a payer.
UPDATE clients c
SET credit_balance = COALESCE((
  SELECT SUM(o.total_amount - o.paid_amount)
  FROM orders o
  WHERE o.client_id = c.id
    AND o.status <> 'ANNULEE'
    AND o.total_amount > o.paid_amount
), 0);
