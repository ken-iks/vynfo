-- name: CreateText :one
INSERT INTO texts (asset_id, display_name, content) VALUES ($1, $2, $3) RETURNING *;

-- name: GetTextById :one
SELECT * FROM texts WHERE asset_id = $1;
