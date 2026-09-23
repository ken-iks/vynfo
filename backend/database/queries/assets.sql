-- name: CreateAsset :one
INSERT INTO assets (workspace_id, asset_type, display_name, directory_id) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: CreateAssetWithId :one
INSERT INTO assets (id, workspace_id, asset_type, display_name, directory_id) VALUES ($1, $2, $3, $4, $5) RETURNING *;

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

-- name: GetAssetById :one
SELECT * FROM assets WHERE id = $1;

-- name: GetInUseAssetProjects :many
SELECT
    project_assets.asset_id,
    assets.display_name asset_display_name,
    projects.id project_id,
    projects.project_name
FROM project_assets
JOIN assets ON assets.id = project_assets.asset_id
JOIN projects ON projects.id = project_assets.project_id
WHERE project_assets.asset_id = $1
ORDER BY projects.project_name;

-- name: DeleteAsset :exec
DELETE FROM assets WHERE id = $1;

-- name: GetAssetsByDirectory :many
SELECT * FROM assets WHERE directory_id = $1;

-- name: GetRootDirectoryAssets :many
SELECT * FROM assets WHERE directory_id IS NULL and workspace_id = $1 ORDER BY created_at;

-- name: ChangeAssetDirectory :exec
UPDATE assets SET directory_id = $1 WHERE id = $2;

-- name: UpdateAssetName :exec
UPDATE assets SET display_name = $1 WHERE id = $2;
