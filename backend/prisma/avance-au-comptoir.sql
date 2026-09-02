-- L'avance d'un client reduit l'espece encaissee au comptoir : on trace la part
-- du ticket reglee par cette avance, distincte de ce qui entre en caisse.

ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS advance_applied numeric(12, 2) NOT NULL DEFAULT 0;
