-- name: CreateImage :one
INSERT INTO images (asset_id, object_path, content_type) VALUES ($1, $2, $3) RETURNING *;

-- name: GetImageById :one
SELECT * FROM images WHERE asset_id = $1;
