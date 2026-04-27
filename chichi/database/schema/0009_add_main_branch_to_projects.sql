-- +goose Up
ALTER TABLE projects ADD COLUMN main_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE projects DROP COLUMN main_branch_id;