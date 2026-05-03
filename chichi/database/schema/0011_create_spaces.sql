-- +goose Up
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE space_members (
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (space_id, member_id)
);

CREATE INDEX idx_spaces_projects ON spaces(project_id, created_at);
CREATE INDEX idx_space_members_member_id ON space_members(member_id);

-- +goose Down
DROP TABLE space_members;
DROP TABLE spaces;