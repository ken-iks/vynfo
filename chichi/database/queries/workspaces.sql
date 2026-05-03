-- name: CreateWorkspace :one
INSERT INTO workspaces (name) VALUES ($1) RETURNING *;

-- name: GetWorkspace :one
SELECT * FROM workspaces WHERE id = $1;

-- name: GetUserWorkspaces :many
SELECT workspaces.* FROM workspaces
JOIN workspace_members ON workspace_members.workspace_id = workspaces.id
WHERE workspace_members.member_id = $1
ORDER BY workspaces.created_at;

-- name: AddWorkspaceMember :exec
INSERT INTO workspace_members (workspace_id, member_id) VALUES ($1, $2)
ON CONFLICT (workspace_id, member_id) DO NOTHING;

-- name: GetWorkspaceMembers :many
SELECT * FROM workspace_members WHERE workspace_id = $1;
