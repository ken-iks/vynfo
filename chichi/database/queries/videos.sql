-- name: GetVideos :many
SELECT * FROM videos WHERE asset_id = ANY(@asset_ids::uuid[]) ;

-- name: CreateVideo :one
INSERT INTO videos (asset_id, duration, has_audio) VALUES ($1, $2, $3) RETURNING *;

-- name: GetVideoById :one
SELECT * FROM videos WHERE asset_id = $1;