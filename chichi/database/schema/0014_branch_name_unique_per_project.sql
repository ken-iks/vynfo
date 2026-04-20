-- +goose Up
ALTER TABLE branches DROP CONSTRAINT unique_branch_name;
ALTER TABLE branches ADD CONSTRAINT unique_branch_name_per_project UNIQUE (project_id, name);

-- +goose Down
ALTER TABLE branches DROP CONSTRAINT unique_branch_name_per_project;
ALTER TABLE branches ADD CONSTRAINT unique_branch_name UNIQUE (name);
