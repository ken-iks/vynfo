-- +goose Up
CREATE TABLE ai_conversation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    input_tokens BIGINT NOT NULL,
    output_tokens BIGINT NOT NULL,
    reasoning_tokens BIGINT NOT NULL,
    num_provider_requests BIGINT NOT NULL,
    num_tool_calls BIGINT NOT NULL
);

-- +goose Down
DROP TABLE ai_conversation_runs;