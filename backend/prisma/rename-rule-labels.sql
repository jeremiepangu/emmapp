UPDATE pricing_rules SET name = replace(name, 'Remise', 'Bonus') WHERE name LIKE '%Remise%';
