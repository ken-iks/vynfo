-- name: CreateWorkspace :one
INSERT INTO workspaces (name) VALUES ($1) RETURNING *;

-- name: GetWorkspace :one
SELECT * FROM workspaces WHERE id = $1;

-- name: GetUserWorkspaces :many
SELECT workspaces.* FROM workspaces
JOIN workspace_members ON workspace_members.workspace_id = workspaces.id
WHERE workspace_members.member_id = $1
ORDER BY workspaces.created_at;

-- name: GetWorkspaceWithMembers :many
SELECT
    w.id workspace_id,
    w.name workspace_name,
    w.created_at workspace_created_at,
    u.id member_id,
    u.email member_email,
    u.display_name member_display_name
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN users u ON u.id = wm.member_id
WHERE w.id = $1
ORDER BY u.email;

-- name: GetUserWorkspacesWithMembers :many
SELECT
    w.id workspace_id,
    w.name workspace_name,
    w.created_at workspace_created_at,
    u.id member_id,
    u.email member_email,
    u.display_name member_display_name
FROM workspaces w
JOIN workspace_members requested_member ON requested_member.workspace_id = w.id
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN users u ON u.id = wm.member_id
WHERE requested_member.member_id = $1
ORDER BY w.created_at, u.email;

-- name: IsWorkspaceMember :one
SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = $1 AND member_id = $2
);

-- name: AddWorkspaceMember :exec
INSERT INTO workspace_members (workspace_id, member_id) VALUES ($1, $2)
ON CONFLICT (workspace_id, member_id) DO NOTHING;

-- name: GetWorkspaceMembers :many
SELECT * FROM workspace_members WHERE workspace_id = $1;
