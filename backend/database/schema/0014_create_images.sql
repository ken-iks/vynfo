-- +goose Up
CREATE TABLE images (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    object_path TEXT NOT NULL,
    content_type TEXT NOT NULL
);

-- +goose Down
DROP TABLE images;
