-- name: CreateCommitParent :one
INSERT INTO commit_parents (commit_id, parent_id, position) VALUES($1, $2, 0) RETURNING *;

-- name: CreateMergeCommitParents :many
INSERT INTO commit_parents (commit_id, parent_id, position) VALUES
    ($1, $2, 0),
    ($1, $3, 1)
RETURNING *;