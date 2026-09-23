-- name: GetAudios :many
SELECT * FROM audios WHERE asset_id = ANY(@asset_ids::uuid[]) ;

-- name: CreateAudio :one
INSERT INTO audios (asset_id, duration) VALUES ($1, $2) RETURNING *;

-- name: GetAudioById :one
SELECT * FROM audios WHERE asset_id = $1;
