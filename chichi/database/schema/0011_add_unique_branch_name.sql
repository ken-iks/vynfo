-- +goose Up
ALTER TABLE branches ADD CONSTRAINT unique_branch_name UNIQUE (name);

-- +goose Down
ALTER TABLE branches DROP CONSTRAINT unique_branch_name;
