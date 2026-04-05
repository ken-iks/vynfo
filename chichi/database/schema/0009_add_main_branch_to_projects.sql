-- +goose Up
ALTER TABLE projects ADD COLUMN main_branch_id UUID REFERENCES branches(id);

-- +goose Down
ALTER TABLE projects DROP COLUMN main_branch_id;