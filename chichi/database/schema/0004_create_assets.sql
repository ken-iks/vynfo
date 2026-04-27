-- +goose Up
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL REFERENCES asset_types(name),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_projects ON assets(project_id, created_at);

-- +goose Down
DROP TABLE assets;