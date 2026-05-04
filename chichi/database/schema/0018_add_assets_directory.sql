-- +goose Up
ALTER TABLE assets ADD COLUMN directory_id UUID REFERENCES directories(id) ON DELETE CASCADE;

CREATE INDEX idx_assets_workspace_directory_created_at ON assets(workspace_id, directory_id, created_at);

-- +goose Down
ALTER TABLE assets DROP COLUMN directory_id; 