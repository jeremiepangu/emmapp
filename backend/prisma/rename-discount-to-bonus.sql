-- La remise devient un bonus : renommage des colonnes sans perte de donnees.
ALTER TABLE order_lines RENAME COLUMN discount TO bonus;
ALTER TABLE pos_sales RENAME COLUMN discount TO bonus;
ALTER TABLE pos_sale_lines RENAME COLUMN discount TO bonus;
