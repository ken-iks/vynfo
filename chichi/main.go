package main

import (
	"context"
	"database/sql"
	"embed"
	"log/slog"
	"net/http"
	"os"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
	"github.com/rs/cors"
	"vynfo.com/vynfo/auth"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/messages"
	"vynfo.com/vynfo/services/project"
	"vynfo.com/vynfo/services/spaces"
	"vynfo.com/vynfo/services/users"
	"vynfo.com/vynfo/services/workspaces"
)

//go:embed database/schema/*.sql
var migrations embed.FS

const address = ":8080"

func runMigrations() (*sql.DB, error) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	goose.SetBaseFS(migrations)
	goose.SetDialect("postgres")
	if err := goose.Up(db, "database/schema"); err != nil {
		return nil, err
	}
	return db, nil
}

func main() {
	godotenv.Load()
	db, err := runMigrations()
	if err != nil {
		slog.Info("error running db migration", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations, sucessful - starting up app")
	//slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})))
	ctx := context.Background()
	firebaseAuth := auth.NewFirebaseAuth(ctx)

	// ==================== ProjectService Deps ========================== //
	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		os.Exit(1)
	}
	defer storageClient.Close()
	ProjectService := project.NewProjectServiceServer(storageClient, db, dbgen.New(db))

	// ==================== SpacesService Deps ========================== //
	listener, err := messages.NewMessageListener(os.Getenv("DATABASE_URL"))
	if err != nil {
		slog.Error("pg listener init", "error", err)
		os.Exit(1)
	}
	defer listener.Close()
	observer := messages.NewMessageOberserver()

	// we use a singleton listener goroutine that handles message update notifications
	go listener.DispatchNotifications(ctx, observer)
	SpacesService := spaces.NewSpacesServiceServer(db, dbgen.New(db), observer)

	// ==================== UsersService Deps ========================== //
	UsersService := users.NewUsersServiceServer(storageClient, db, dbgen.New(db))
	WorkspacesService := workspaces.NewWorkspacesServiceServer(db, dbgen.New(db))

	mux := http.NewServeMux()
	// Proto service endpoints
	mux.Handle(
		v1connect.NewProjectServiceHandler(
			ProjectService,
			connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
		),
	)
	mux.Handle(
		v1connect.NewSpacesServiceHandler(
			SpacesService,
			connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
		),
	)
	mux.Handle(
		v1connect.NewWorkspacesServiceHandler(
			WorkspacesService,
			connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
		),
	)
	mux.Handle(
		v1connect.NewUsersServiceHandler(
			UsersService,
			connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
		),
	)
	// Http service endpoints for HLS video serving
	mux.HandleFunc("GET /video", ProjectService.GetManifest)
	mux.Handle(
		"GET /segments/",
		http.StripPrefix("/segments/", http.FileServer(http.Dir("segments"))),
	)
	slog.Info("startup successful", "port", address)
	http.ListenAndServe(
		address,
		cors.AllowAll().Handler(mux),
	)
}
