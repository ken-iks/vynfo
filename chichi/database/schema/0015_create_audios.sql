-- +goose Up
CREATE TABLE audios (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    duration DOUBLE PRECISION NOT NULL
);

-- +goose Down
DROP TABLE audios;