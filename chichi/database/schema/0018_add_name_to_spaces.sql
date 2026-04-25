-- +goose Up
ALTER TABLE spaces ADD COLUMN name TEXT NOT NULL;

-- +goose Down
ALTER TABLE spaces DROP COLUMN name;
