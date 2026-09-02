-- Consignes valorisees par format, versements libres et suivi des ecarts.

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "ConsigneMovementSource" AS ENUM ('LIVRAISON', 'POS', 'COMMANDE', 'RETOUR', 'AJUSTEMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderPaymentStatus" AS ENUM ('IMPAYEE', 'PARTIELLE', 'SOLDEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscrepancyKind" AS ENUM ('CAISSE', 'TOURNEE', 'VIDANGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscrepancyStatus" AS ENUM ('OUVERT', 'JUSTIFIE', 'REGULARISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CashClosingStatus" AS ENUM ('OUVERTE', 'CLOTUREE', 'VALIDEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Solde de vidange par client et par format
CREATE TABLE IF NOT EXISTS client_consigne_balances (
  id             text PRIMARY KEY,
  client_id      text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_format "ProductFormat" NOT NULL,
  quantity       integer NOT NULL DEFAULT 0,
  amount         numeric(12, 2) NOT NULL DEFAULT 0,
  updated_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT client_consigne_balances_client_format_key UNIQUE (client_id, product_format)
);

-- 3. Mouvements de consigne valorises et traçables
ALTER TABLE consigne_movements ADD COLUMN IF NOT EXISTS unit_value numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE consigne_movements ADD COLUMN IF NOT EXISTS amount numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE consigne_movements ADD COLUMN IF NOT EXISTS source "ConsigneMovementSource" NOT NULL DEFAULT 'LIVRAISON';
ALTER TABLE consigne_movements ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE consigne_movements ADD COLUMN IF NOT EXISTS pos_sale_id text;

-- 4. Consigne facturee sur les lignes et les pieces de vente
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS empties_returned integer NOT NULL DEFAULT 0;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS consigne_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS consigne_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE pos_sale_lines ADD COLUMN IF NOT EXISTS empties_returned integer NOT NULL DEFAULT 0;
ALTER TABLE pos_sale_lines ADD COLUMN IF NOT EXISTS consigne_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE pos_sale_lines ADD COLUMN IF NOT EXISTS consigne_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS consigne_amount numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS consigne_amount numeric(12, 2) NOT NULL DEFAULT 0;

-- 5. Suivi du reste a payer
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status "OrderPaymentStatus" NOT NULL DEFAULT 'IMPAYEE';

-- 6. Cloture de caisse
CREATE TABLE IF NOT EXISTS cash_closings (
  id              text PRIMARY KEY,
  reference       text NOT NULL UNIQUE,
  cashier_id      text NOT NULL REFERENCES users(id),
  opened_at       timestamp(3) NOT NULL,
  closed_at       timestamp(3),
  expected_amount numeric(12, 2) NOT NULL DEFAULT 0,
  counted_amount  numeric(12, 2) NOT NULL DEFAULT 0,
  variance        numeric(12, 2) NOT NULL DEFAULT 0,
  status          "CashClosingStatus" NOT NULL DEFAULT 'OUVERTE',
  notes           text,
  created_at      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Journal unifie des ecarts
CREATE TABLE IF NOT EXISTS discrepancies (
  id             text PRIMARY KEY,
  reference      text NOT NULL,
  kind           "DiscrepancyKind" NOT NULL,
  status         "DiscrepancyStatus" NOT NULL DEFAULT 'OUVERT',
  label          text NOT NULL,
  expected       numeric(12, 2) NOT NULL DEFAULT 0,
  actual         numeric(12, 2) NOT NULL DEFAULT 0,
  variance       numeric(12, 2) NOT NULL DEFAULT 0,
  client_id      text REFERENCES clients(id),
  tour_id        text REFERENCES tours(id),
  cash_closing_id text REFERENCES cash_closings(id) ON DELETE CASCADE,
  product_format "ProductFormat",
  resolved_by_id text REFERENCES users(id),
  resolved_at    timestamp(3),
  notes          text,
  created_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS discrepancies_kind_status_idx ON discrepancies (kind, status);
CREATE INDEX IF NOT EXISTS discrepancies_created_at_idx ON discrepancies (created_at);
CREATE INDEX IF NOT EXISTS cash_closings_cashier_idx ON cash_closings (cashier_id, opened_at);
CREATE INDEX IF NOT EXISTS client_consigne_balances_client_idx ON client_consigne_balances (client_id);

-- 8. Reprise des donnees existantes

-- 8a. Soldes de vidange par format, reconstitues depuis l'historique des mouvements.
INSERT INTO client_consigne_balances (id, client_id, product_format, quantity, amount, updated_at)
SELECT
  gen_random_uuid()::text,
  m.client_id,
  m.product_format,
  SUM(m.qty_out - m.qty_in)::integer,
  0,
  CURRENT_TIMESTAMP
FROM consigne_movements m
GROUP BY m.client_id, m.product_format
ON CONFLICT (client_id, product_format) DO NOTHING;

-- 8b. Valorisation des soldes au montant de consigne du produit du format concerne.
UPDATE client_consigne_balances b
SET amount = b.quantity * COALESCE((
  SELECT MAX(p.consigne_amount)
  FROM products p
  WHERE p.format = b.product_format AND p.is_reusable = true
), 0);

-- 8b bis. Le total agrege du client doit refleter la somme des soldes par format.
UPDATE clients c
SET consigne_balance = COALESCE((
  SELECT SUM(b.quantity)
  FROM client_consigne_balances b
  WHERE b.client_id = c.id
), 0);

-- 8c. Montants deja regles par commande, deduits des paiements enregistres.
UPDATE orders o
SET paid_amount = COALESCE((
  SELECT SUM(p.amount)
  FROM payments p
  WHERE p.order_id = o.id
), 0) + COALESCE((
  SELECT SUM(p.amount)
  FROM payments p
  JOIN deliveries d ON d.id = p.delivery_id
  WHERE d.order_id = o.id AND p.order_id IS NULL
), 0);

UPDATE orders
SET payment_status = CASE
  WHEN paid_amount <= 0 THEN 'IMPAYEE'::"OrderPaymentStatus"
  WHEN paid_amount >= total_amount THEN 'SOLDEE'::"OrderPaymentStatus"
  ELSE 'PARTIELLE'::"OrderPaymentStatus"
END;

-- 8d. Dette en argent du client : somme des restes a payer des commandes non annulees.
UPDATE clients c
SET credit_balance = COALESCE((
  SELECT SUM(GREATEST(o.total_amount - o.paid_amount, 0))
  FROM orders o
  WHERE o.client_id = c.id AND o.status <> 'ANNULEE'
), 0);
