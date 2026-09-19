-- Le bonus n'est plus un pourcentage mais un article offert par tranche achetee.
ALTER TYPE "PricingRuleType" RENAME VALUE 'PERCENT' TO 'ARTICLE_OFFERT';

-- La valeur porte desormais le nombre d'articles offerts par lot (1 pour 10 achetes).
UPDATE pricing_rules SET value = 1 WHERE type = 'ARTICLE_OFFERT';

-- Quantite offerte, livree en plus mais non facturee.
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS bonus_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE pos_sale_lines ADD COLUMN IF NOT EXISTS bonus_quantity integer NOT NULL DEFAULT 0;
