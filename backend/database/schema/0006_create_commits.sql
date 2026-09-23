-- +goose Up
CREATE TABLE commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- +goose Down
DROP TABLE commits;