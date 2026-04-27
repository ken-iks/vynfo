-- name: CreateImage :one
INSERT INTO images (asset_id, display_name, object_path, content_type) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetImageById :one
SELECT * FROM images WHERE asset_id = $1;
