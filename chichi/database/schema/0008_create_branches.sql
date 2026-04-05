-- +goose Up
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    tip_commit_id UUID REFERENCES commits(id)
);

-- +goose Down
DROP TABLE branches;