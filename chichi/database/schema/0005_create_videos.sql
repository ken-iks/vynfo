-- +goose Up
CREATE TABLE videos (
    asset_id UUID PRIMARY KEY REFERENCES assets(id),
    display_name TEXT NOT NULL,
    duration NUMERIC NOT NULL
);

-- +goose Down
DROP TABLE videos;