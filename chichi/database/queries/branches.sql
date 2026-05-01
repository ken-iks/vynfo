-- name: CreateBranch :one
INSERT INTO branches (project_id, name) VALUES ($1, $2) RETURNING *;

-- name: SetBranchCommitID :one
UPDATE branches SET tip_commit_id = $1 WHERE id = $2 RETURNING *;

-- name: ListProjectBranches :many
SELECT * FROM branches WHERE project_id = $1;

-- name: ListBranchesByTipCommit :many
SELECT * FROM branches WHERE project_id = $1 AND tip_commit_id = $2;

-- name: CreateMainBranch :one
INSERT INTO branches (project_id, name) VALUES ($1, 'main') RETURNING *;

-- name: GetMainBranch :one
SELECT * FROM branches WHERE name = 'main';

-- name: GetBranchByName :one
SELECT * FROM branches WHERE project_id = $1 AND name = $2;

-- name: GetBranchCommitHistory :many
WITH RECURSIVE history AS (
    SELECT c.*
    FROM branches b
    JOIN commits c ON c.id = b.tip_commit_id
    WHERE b.id = $1

    UNION

    SELECT c.*
    FROM commits c
    JOIN commit_parents cp ON cp.parent_id = c.id
    JOIN history h ON h.id = cp.commit_id
)
SELECT * FROM history;