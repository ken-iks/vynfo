-- name: GetProject :one
SELECT * FROM projects WHERE id = $1;

-- name: GetUserProjects :many
SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at;

-- name: CreateProject :one
INSERT INTO projects (user_id, project_name, project_description) VALUES ($1, $2, $3) RETURNING *;


