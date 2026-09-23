-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserFromFirebase :one
SELECT * FROM users WHERE firebase_uid = $1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY email;

-- name: CreateUserByFirebaseUID :one
INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING *;

-- name: FinishUserOnboarding :one
UPDATE users
    SET display_name = $1,
        display_photo_object_path = $2,
        onboarded_at = $3
WHERE id = $4 RETURNING *;

-- name: GetOrCreateUserByFirebaseId :one
WITH inserted AS (
    INSERT INTO users (firebase_uid, email)
    VALUES ($1, $2)
    ON CONFLICT (firebase_uid) DO NOTHING
    RETURNING *
)
SELECT * FROM inserted
UNION ALL
SELECT * FROM users WHERE firebase_uid = $1
LIMIT 1;