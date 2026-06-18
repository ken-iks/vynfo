-- +goose Up
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    conversation_owner_id UUID NOT NULL REFERENCES users(id),
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    client_id TEXT UNIQUE
);

-- +goose Down
DROP TABLE ai_conversations;
