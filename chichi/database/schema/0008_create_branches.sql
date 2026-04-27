-- +goose Up
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tip_commit_id UUID REFERENCES commits(id) ON DELETE SET NULL
);

-- +goose Down
DROP TABLE branches;