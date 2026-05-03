-- +goose Up
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- use reply count to cheaply determine if a message has children
    reply_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_messages_spaces ON messages(space_id, created_at) WHERE parent_id IS NULL;
CREATE INDEX idx_messages_parent ON messages(parent_id, created_at) WHERE parent_id IS NOT NULL;

-- +goose Down
DROP TABLE messages;