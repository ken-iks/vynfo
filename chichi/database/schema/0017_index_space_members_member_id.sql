-- +goose Up
CREATE INDEX idx_space_members_member_id ON space_members(member_id);

-- +goose Down
DROP INDEX idx_space_members_member_id;
