-- +goose Up
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    display_photo_object_path TEXT,
    onboarded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- +goose Down
DROP TABLE users;