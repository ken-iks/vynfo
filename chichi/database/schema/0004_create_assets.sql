-- +goose Up
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL REFERENCES asset_types(name),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_assets (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, asset_id)
);

CREATE INDEX idx_assets_workspace_created_at ON assets(workspace_id, created_at);
CREATE INDEX idx_project_assets_asset_id ON project_assets(asset_id);

-- +goose Down
DROP TABLE project_assets;
DROP TABLE assets;