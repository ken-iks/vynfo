-- +goose Up
CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, member_id)
);

CREATE INDEX idx_project_members_member_id ON project_members(member_id);

-- +goose Down
DROP INDEX idx_project_members_member_id;
DROP TABLE project_members;