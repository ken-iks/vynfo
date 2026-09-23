-- +goose Up
ALTER TABLE ai_conversation_messages
ADD COLUMN client_id TEXT,
ADD COLUMN parent_id UUID REFERENCES ai_conversation_messages(id) ON DELETE SET NULL,
ADD COLUMN position INT NOT NULL DEFAULT 0,
ADD COLUMN ordinal BIGINT GENERATED ALWAYS AS IDENTITY;

UPDATE ai_conversation_messages
SET client_id = id::text;

ALTER TABLE ai_conversation_messages
ALTER COLUMN client_id SET NOT NULL;

CREATE UNIQUE INDEX conversation_message_conv_client_id ON ai_conversation_messages(conversation_id, client_id);
CREATE INDEX conversation_message_conv_ordinal ON ai_conversation_messages(conversation_id, ordinal);
CREATE INDEX conversation_message_conv_parent_position ON ai_conversation_messages(conversation_id, parent_id, position);

-- +goose Down
DROP INDEX conversation_message_conv_parent_position;
DROP INDEX conversation_message_conv_ordinal;
DROP INDEX conversation_message_conv_client_id;

ALTER TABLE ai_conversation_messages
DROP COLUMN ordinal,
DROP COLUMN position,
DROP COLUMN parent_id,
DROP COLUMN client_id;
