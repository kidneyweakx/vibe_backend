-- Add normal column to tags table
ALTER TABLE tags ADD COLUMN normal BOOLEAN NOT NULL DEFAULT false;
