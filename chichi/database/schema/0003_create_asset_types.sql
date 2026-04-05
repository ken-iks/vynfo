-- +goose Up
CREATE TABLE asset_types (
    name TEXT PRIMARY KEY
);

INSERT INTO asset_types (name) VALUES ('video'), ('photo'), ('text');

-- +goose Down
DROP TABLE asset_types;