-- migrate-006-tag-color.sql
-- Add color column to tags table

ALTER TABLE tags
  ADD COLUMN color VARCHAR(20) DEFAULT '#999999' AFTER name;

SELECT 'migrate-006-tag-color.sql executed successfully' AS result;
