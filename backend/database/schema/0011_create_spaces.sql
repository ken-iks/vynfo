-- +goose Up
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE space_members (
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (space_id, member_id)
);

CREATE INDEX idx_space_members_member_id ON space_members(member_id);
CREATE INDEX idx_space_workspace_id_created_at ON spaces(workspace_id, updated_at DESC);

-- +goose Down
DROP TABLE space_members;
DROP TABLE spaces;