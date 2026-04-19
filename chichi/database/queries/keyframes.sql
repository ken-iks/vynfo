-- name: CreateKeyFrame :one
INSERT INTO keyframes (video_id, timestamp_in_video, segment_idx, byte_offset_in_segment, size_in_bytes) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: GetKeyFrameRange :many
SELECT * FROM keyframes WHERE video_id = $1 AND timestamp_in_video >= $2 ORDER BY (segment_idx, byte_offset_in_segment) DESC LIMIT $3;