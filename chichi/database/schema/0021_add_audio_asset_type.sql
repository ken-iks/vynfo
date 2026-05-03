-- +goose Up
INSERT INTO asset_types (name) VALUES ('audio');

-- +goose Down
DELETE FROM asset_types WHERE name = 'audio';