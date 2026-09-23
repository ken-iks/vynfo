-- +goose Up
ALTER TABLE ai_conversations
ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE ai_conversations
DROP COLUMN project_id;