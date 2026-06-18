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
INSERT INTO ai_conversation_runs (conversation_id, input_tokens, output_tokens, reasoning_tokens, num_provider_requests, num_tool_calls) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: ListAIConversationMessages :many
SELECT *
FROM ai_conversation_messages
WHERE conversation_id = $1
ORDER BY sent_at DESC, id DESC
LIMIT $2;

-- name: ListAIConversationMessagesForConversation :many
SELECT *
FROM ai_conversation_messages
WHERE conversation_id = $1
ORDER BY sent_at, id;

-- name: AddAIConversationMessage :one
WITH new_message AS (
    INSERT INTO ai_conversation_messages (conversation_id, run_id, message_content_json_string) VALUES ($1, $2, $3) RETURNING *
), bump_conversation AS (
    UPDATE ai_conversations SET last_updated_at = (SELECT sent_at FROM new_message) WHERE id = $1
)
SELECT * FROM new_message;
