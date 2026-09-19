-- Encaissement anticipe : un versement peut etre garde au credit du client
-- au lieu d'etre impute immediatement sur ses commandes dues.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_advance boolean NOT NULL DEFAULT false;

-- Reprise : un versement sans imputation ni commande rattachee correspond a
-- une avance, qu'elle vienne d'un depot anticipe ou d'un trop-percu conserve.
UPDATE payments p
SET is_advance = true
WHERE p.order_id IS NULL
  AND p.delivery_id IS NULL
  AND p.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_allocations a WHERE a.payment_id = p.id);
