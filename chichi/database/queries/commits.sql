-- name: CreateCommit :one
INSERT INTO commits (user_id, project_id, state, message) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetCommitByID :one
SELECT * FROM commits WHERE id = $1;

-- name: ListUserCommits :many
SELECT * FROM commits WHERE user_id = $1;
