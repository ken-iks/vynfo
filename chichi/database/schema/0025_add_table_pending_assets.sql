-- +goose Up
CREATE TABLE pending_assets (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id)
);

-- +goose Down
DROP TABLE pending_assets;