-- +goose Up
ALTER TABLE videos ALTER COLUMN duration TYPE DOUBLE PRECISION;

-- +goose Down
ALTER TABLE videos ALTER COLUMN duration TYPE NUMERIC;
