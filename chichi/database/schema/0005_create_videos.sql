-- +goose Up
CREATE TABLE videos (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    duration DOUBLE PRECISION NOT NULL
);

-- +goose Down
DROP TABLE videos;