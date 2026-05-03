-- name: CreateAsset :one
INSERT INTO assets (workspace_id, asset_type) VALUES ($1, $2) RETURNING *;

-- name: AddProjectAsset :exec
INSERT INTO project_assets (project_id, asset_id) VALUES ($1, $2)
ON CONFLICT (project_id, asset_id) DO NOTHING;

-- name: GetProjectAssets :many
SELECT assets.* FROM assets
JOIN project_assets ON project_assets.asset_id = assets.id
WHERE project_assets.project_id = $1
ORDER BY assets.created_at;

-- name: GetWorkspaceAssets :many
SELECT * FROM assets WHERE workspace_id = $1 ORDER BY created_at;

-- name: DeleteAsset :exec
DELETE FROM assets WHERE id = $1;
