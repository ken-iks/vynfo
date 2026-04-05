-- +goose Up
CREATE TABLE commit_parents (
    commit_id UUID NOT NULL REFERENCES commits(id),
    parent_id UUID NOT NULL REFERENCES commits(id),
    position INT NOT NULL,  -- 0 = first parent, 1 = second (merge source)
    PRIMARY KEY (commit_id, parent_id)
);

-- +goose Down
DROP TABLE commit_parents;