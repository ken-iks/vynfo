-- name: GetOrCreateAIConversation :one
INSERT INTO ai_conversations (title, conversation_owner_id, client_id) 
VALUES ($1, $2, $3) 
ON CONFLICT (client_id) DO UPDATE SET last_updated_at = ai_conversations.last_updated_at 
RETURNING *;

-- name: GetUserAIConversation :one
SELECT *
FROM ai_conversations
WHERE id = $1 AND conversation_owner_id = $2;

-- name: GetAIConversationByClientID :one
SELECT *
FROM ai_conversations
WHERE client_id = $1 AND conversation_owner_id = $2;

-- name: UpdateAIConversationTitle :one
UPDATE ai_conversations
SET title = $1
WHERE id = $2 AND conversation_owner_id = $3
RETURNING *;

-- name: ArchiveAIConversation :one
UPDATE ai_conversations
SET is_archived = TRUE
WHERE id = $1 AND conversation_owner_id = $2
RETURNING *;

-- name: UnArchiveAIConversation :one
UPDATE ai_conversations
SET is_archived = FALSE
WHERE id = $1 AND conversation_owner_id = $2
RETURNING *;

-- name: DeleteAIConversation :execrows
DELETE FROM ai_conversations
WHERE id = $1 AND conversation_owner_id = $2;

-- name: ListUserAIConversations :many
SELECT *
FROM ai_conversations
WHERE conversation_owner_id = $1
ORDER BY last_updated_at DESC;

-- name: AssertConversationUser :one
SELECT EXISTS (
    SELECT 1 FROM ai_conversations
    WHERE id = $1 AND conversation_owner_id = $2
);

-- name: CreateAiConversationRun :one
INSERT INTO ai_conversation_runs (conversation_id, input_tokens, output_tokens, reasoning_tokens, num_provider_requests, num_tool_calls, run_messages) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: ListAIConversationRuns :many
SELECT * FROM ai_conversation_runs WHERE conversation_id = $1 ORDER BY completed_at DESC, id DESC LIMIT $2;

-- name: ListAIConversationRunsForMessagePath :many
WITH RECURSIVE message_path AS (
    SELECT ai_conversation_messages.id, ai_conversation_messages.parent_id, ai_conversation_messages.run_id
    FROM ai_conversation_messages
    WHERE ai_conversation_messages.id = $1 AND ai_conversation_messages.conversation_id = $2
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.run_id
    FROM ai_conversation_messages parent
    JOIN message_path child ON child.parent_id = parent.id
    WHERE parent.conversation_id = $2
), path_runs AS (
    SELECT DISTINCT run_id
    FROM message_path
)
SELECT ai_conversation_runs.*
FROM ai_conversation_runs
JOIN path_runs ON path_runs.run_id = ai_conversation_runs.id
ORDER BY ai_conversation_runs.completed_at, ai_conversation_runs.id;

-- name: ListAIConversationMessages :many
SELECT child.*, parent.client_id parent_client_id
FROM ai_conversation_messages child
LEFT JOIN ai_conversation_messages parent ON parent.id = child.parent_id
WHERE child.conversation_id = $1
ORDER BY child.ordinal DESC
LIMIT $2;

-- name: ListAIConversationMessagesForConversation :many
SELECT child.*, parent.client_id parent_client_id
FROM ai_conversation_messages child
LEFT JOIN ai_conversation_messages parent ON parent.id = child.parent_id
WHERE child.conversation_id = $1
ORDER BY child.ordinal;

-- name: GetAIConversationMessageForConversation :one
SELECT *
FROM ai_conversation_messages
WHERE client_id = $1 AND conversation_id = $2;

-- name: NextAIConversationMessagePosition :one
SELECT COALESCE(MAX(position), -1) + 1
FROM ai_conversation_messages
WHERE conversation_id = $1
  AND parent_id IS NOT DISTINCT FROM $2;

-- name: AddAIConversationMessage :one
WITH new_message AS (
    INSERT INTO ai_conversation_messages (conversation_id, run_id, message_content_as_json, client_id, parent_id, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
), bump_conversation AS (
    UPDATE ai_conversations SET last_updated_at = (SELECT sent_at FROM new_message) WHERE id = $1
)
SELECT * FROM new_message;
