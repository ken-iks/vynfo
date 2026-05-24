-- +goose Up
ALTER TABLE videos ADD COLUMN has_audio BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE videos DROP COLUMN has_audio;
