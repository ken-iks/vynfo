-- +goose Up
CREATE TABLE images (
    asset_id UUID PRIMARY KEY REFERENCES assets(id),
    display_name TEXT NOT NULL,
    object_path TEXT NOT NULL,
    content_type TEXT NOT NULL
);

CREATE TABLE texts (
    asset_id UUID PRIMARY KEY REFERENCES assets(id),
    display_name TEXT NOT NULL,
    content TEXT NOT NULL
);

-- +goose Down
DROP TABLE texts;
DROP TABLE images;
