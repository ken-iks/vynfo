-- name: CreateAudioFrame :one
INSERT INTO audioframes (audio_id, timestamp_in_audio, segment_idx, byte_offset_in_segment, size_in_bytes) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: GetAudioFrameRange :many
SELECT * FROM audioframes WHERE audio_id = $1 AND timestamp_in_audio >= $2 ORDER BY (segment_idx, byte_offset_in_segment) ASC LIMIT $3;
