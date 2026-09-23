-- name: GetProject :one
SELECT * FROM projects WHERE id = $1;

-- name: GetWorkspaceProjects :many
SELECT * FROM projects WHERE workspace_id = $1 ORDER BY created_at;

-- name: GetWorkspaceProjectsWithCreators :many
SELECT
    projects.*,
    users.email creator_email,
    users.display_name creator_display_name,
    users.display_photo_object_path creator_display_photo_object_path
FROM projects
JOIN users ON users.id = projects.user_id
WHERE projects.workspace_id = $1
ORDER BY projects.created_at;

-- name: CreateProject :one
INSERT INTO projects (workspace_id, user_id, project_name, project_description) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: AddProjectMember :exec
INSERT INTO project_members (project_id, member_id) VALUES ($1, $2)
ON CONFLICT (project_id, member_id) DO NOTHING;

-- name: DeleteProject :execrows
DELETE FROM projects WHERE id = $1 AND user_id = $2;

-- name: SetMainBranch :one
UPDATE projects SET main_branch_id = $1 WHERE id = $2 RETURNING *; 

-- name: RemoveAssetFromProject :exec
DELETE FROM project_assets WHERE project_id = $1 AND asset_id = $2;

