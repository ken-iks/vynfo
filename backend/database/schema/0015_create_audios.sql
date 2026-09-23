-- +goose Up
CREATE TABLE audios (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    duration DOUBLE PRECISION NOT NULL
);

-- +goose Down
DROP TABLE audios;