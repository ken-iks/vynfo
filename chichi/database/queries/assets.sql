-- name: CreateAsset :one
INSERT INTO assets (project_id, asset_type) VALUES ($1, $2) RETURNING *;

-- name: GetProjectAssets :many
SELECT * FROM assets WHERE project_id = $1 ORDER BY created_at;

-- name: DeleteAsset :exec
DELETE FROM assets WHERE id = $1;
