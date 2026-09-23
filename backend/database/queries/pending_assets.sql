-- name: AddPendingAsset :one
INSERT INTO pending_assets (asset_id, user_id) VALUES ($1, $2) RETURNING *;

-- name: GetPendingAsset :one
SELECT * FROM pending_assets WHERE asset_id = $1 AND user_id = $2;

-- name: DeletePendingAsset :exec
DELETE FROM pending_assets WHERE asset_id = $1 AND user_id = $2;