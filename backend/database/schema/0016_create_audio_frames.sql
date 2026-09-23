-- +goose Up
CREATE TABLE audioframes (
    audio_id UUID NOT NULL REFERENCES audios(asset_id) ON DELETE CASCADE,
    timestamp_in_audio BIGINT NOT NULL,
    segment_idx BIGINT NOT NULL,
    byte_offset_in_segment BIGINT NOT NULL,
    size_in_bytes BIGINT NOT NULL,
    PRIMARY KEY (audio_id, timestamp_in_audio)
);

CREATE INDEX idx_segments_offsets_audio ON audioframes(segment_idx, byte_offset_in_segment);

-- +goose Down
DROP TABLE audioframes;