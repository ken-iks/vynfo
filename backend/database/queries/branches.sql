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
    SELECT c.*, 0 AS depth
    FROM branches b
    JOIN commits c ON c.id = b.tip_commit_id
    WHERE b.project_id = $1 AND b.id = $2

    UNION

    SELECT c.*, h.depth + 1 AS depth
    FROM commits c
    JOIN commit_parents cp ON cp.parent_id = c.id
    JOIN history h ON h.id = cp.commit_id
    WHERE cp.position = 0
)
SELECT id, user_id, project_id, state, message, created_at FROM history ORDER BY depth;