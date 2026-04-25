-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY email;

-- name: CreateUser :one
INSERT INTO users (email) VALUES ($1) RETURNING *;