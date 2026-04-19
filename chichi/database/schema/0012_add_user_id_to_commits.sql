-- +goose Up
ALTER TABLE commits ADD COLUMN user_id UUID NOT NULL REFERENCES users(id);

-- +goose Down
ALTER TABLE commits DROP COLUMN user_id;
