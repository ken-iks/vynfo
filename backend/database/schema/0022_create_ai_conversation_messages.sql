-- +goose Up
CREATE TABLE ai_conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES ai_conversation_runs(id) ON DELETE CASCADE,
    message_content_as_json JSONB NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX conversation_message_conv_id_sent_at ON ai_conversation_messages(conversation_id, sent_at);

-- +goose Down
DROP TABLE ai_conversation_messages;