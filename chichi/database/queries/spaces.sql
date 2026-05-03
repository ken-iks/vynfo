-- name: GetWorkspaceSpaces :many
SELECT * FROM spaces WHERE workspace_id = $1 ORDER BY updated_at DESC;

-- name: GetWorkspaceSpacesWithMembers :many
SELECT
    s.id space_id,
    s.workspace_id,
    s.admin_id,
    s.name,
    s.created_at,
    s.updated_at,
    u.id member_id,
    u.email member_email
FROM spaces s
LEFT JOIN space_members sm ON sm.space_id = s.id
LEFT JOIN users u ON u.id = sm.member_id
WHERE s.workspace_id = $1
ORDER BY s.updated_at DESC, u.email;

-- name: GetUserSpacesWithMembers :many
SELECT
    s.id space_id,
    s.workspace_id,
    s.admin_id,
    s.name,
    s.created_at,
    s.updated_at,
    u.id member_id,
    u.email member_email
FROM spaces s
JOIN space_members requested_member ON requested_member.space_id = s.id
LEFT JOIN space_members sm ON sm.space_id = s.id
LEFT JOIN users u ON u.id = sm.member_id
WHERE requested_member.member_id = $1
ORDER BY s.updated_at DESC, u.email;

-- name: GetUserSpaces :many
SELECT * FROM spaces WHERE id IN (
    SELECT space_id FROM space_members WHERE member_id = $1
);

-- name: GetSpaceMembers :many
SELECT * FROM space_members WHERE space_id = $1;

-- name: ListSpaceMessages :many
SELECT
    m.id,
    m.space_id,
    m.author_id,
    m.parent_id,
    m.body,
    m.created_at,
    m.reply_count,
    u.email author_email
FROM messages m
JOIN users u ON u.id = m.author_id
WHERE m.space_id = sqlc.arg(space_id)
  AND m.parent_id IS NOT DISTINCT FROM sqlc.narg(parent_id)
ORDER BY m.created_at;

-- name: TriggerSpaceNotification :exec
SELECT pg_notify('space_change', @space_id::TEXT);

-- name: CreateSpace :one
INSERT INTO spaces (workspace_id, admin_id, name) VALUES ($1, $2, $3) RETURNING *;

-- name: GetSpace :one
SELECT * FROM spaces WHERE id = $1;

-- name: TouchSpace :exec
UPDATE spaces SET updated_at = NOW() WHERE id = $1;

-- name: AddSpaceMember :exec
INSERT INTO space_members (space_id, member_id) VALUES ($1, $2)
ON CONFLICT (space_id, member_id) DO NOTHING;

-- name: AddMessageToSpace :one
INSERT INTO messages (space_id, author_id, body) VALUES ($1, $2, $3) RETURNING *;

-- name: AddBranchedMessageToSpace :one
with new_message AS (
    INSERT INTO messages (space_id, author_id, body, parent_id) VALUES ($1, $2, $3, $4) RETURNING *
), bump_reply_count AS (
    UPDATE messages SET reply_count = reply_count + 1 WHERE id = $4
) SELECT * FROM new_message;

