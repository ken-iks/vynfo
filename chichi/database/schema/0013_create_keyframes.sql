-- +goose Up
CREATE TABLE keyframes (
    video_id UUID NOT NULL REFERENCES videos(asset_id),
    timestamp_in_video BIGINT NOT NULL,
    segment_idx BIGINT NOT NULL,
    byte_offset_in_segment BIGINT NOT NULL,
    size_in_bytes BIGINT NOT NULL,
    PRIMARY KEY (video_id, timestamp_in_video)
);

CREATE INDEX idx_segments_offsets ON keyframes(segment_idx, byte_offset_in_segment);

-- +goose Down
DROP TABLE keyframes;