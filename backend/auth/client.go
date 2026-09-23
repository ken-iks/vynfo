package auth

import (
	"context"
	"log"

	firebase "firebase.google.com/go/v4"
	fbauth "firebase.google.com/go/v4/auth"
)

func NewFirebaseAuth(ctx context.Context) *fbauth.Client {
	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Fatalf("firebase app init: %v", err)
	}

	client, err := app.Auth(ctx)
	if err != nil {
		log.Fatalf("firebase auth init: %v", err)
	}

	return client
}
