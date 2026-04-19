-- name: CreateCommit :one
INSERT INTO commits (project_id, state, message) VALUES ($1, $2, $3) RETURNING *;

-- name: GetCommitByID :one
SELECT * FROM commits WHERE id = $1;

-- name: ListUserCommits :many
SELECT * FROM commits WHERE user_id = $1;
