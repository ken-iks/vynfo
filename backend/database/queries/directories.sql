-- name: CreateDirectory :one
INSERT INTO directories (workspace_id, display_name, parent_id) VALUES ($1, $2, $3) RETURNING *;

-- name: GetDirectoryById :one
SELECT * FROM directories WHERE id = $1;

-- name: GetRootDirectories :many
SELECT * FROM directories WHERE parent_id IS NULL AND workspace_id = $1 ORDER BY created_at;

-- name: GetDirectoryChildren :many
SELECT * FROM directories WHERE parent_id = $1 ORDER BY created_at;

-- name: ChangeDirectoryParent :exec
UPDATE directories SET parent_id = $1 WHERE id = $2;

-- name: DeleteDirectory :exec
DELETE FROM directories WHERE id = $1;

-- name: UpdateDirectoryName :exec
UPDATE directories SET display_name = $1 WHERE id = $2;