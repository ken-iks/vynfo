package main

import (
	"context"
	"database/sql"
	"embed"
	"log/slog"
	"net"
	"net/http"
	"os"

	"cloud.google.com/go/storage"
	"connectrpc.com/connect"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"vynfo.com/vynfo/auth"
	agentbackendpb "vynfo.com/vynfo/gen/proto/v1/inter/agent_backend"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
	"vynfo.com/vynfo/messages"
	agentbackend "vynfo.com/vynfo/services/agent-backend"
	"vynfo.com/vynfo/services/conversation"
	"vynfo.com/vynfo/services/project"
	"vynfo.com/vynfo/services/spaces"
	"vynfo.com/vynfo/services/users"
	"vynfo.com/vynfo/services/vfs"
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

func runInternalServices(queries *dbgen.Queries) {
	listener, err := net.Listen("tcp", ":50052")
	if err != nil {
		slog.Error("grpc listen error", "error", err)
		os.Exit(1)
	}

	agentBackendService := agentbackend.NewAgentBackServiceServer(queries)
	grpcServer := grpc.NewServer()

	agentbackendpb.RegisterAgentBackendServiceServer(grpcServer, agentBackendService)
	if err := grpcServer.Serve(listener); err != nil {
		slog.Error("grpc serve error", "error", err)
		os.Exit(1)
	}
}

func mountConnectHandler(mux *http.ServeMux, path string, handler http.Handler) {
	mux.Handle(path, handler)
	mux.Handle("/api"+path, http.StripPrefix("/api", handler))
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

	vynfoClients, err := InitiateClients()
	if err != nil {
		slog.Error("vynfo clients init error", "error", err)
	}

	// ==================== ProjectService Deps ========================== //
	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		os.Exit(1)
	}
	defer storageClient.Close()
	ProjectService := project.NewProjectServiceServer(storageClient, db, dbgen.New(db))

	FileService := vfs.NewFileServiceServer(storageClient, db, dbgen.New(db))

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

	// ==================== Conversations Deps ========================== //
	ConversationsService := conversations.NewConversationServiceServer(
		storageClient,
		db,
		dbgen.New(db),
		vynfoClients.Mensah,
	)

	mux := http.NewServeMux()
	// Proto service endpoints
	projectPath, projectHandler := v1connect.NewProjectServiceHandler(
		ProjectService,
		connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
	)
	mountConnectHandler(mux, projectPath, projectHandler)
	spacesPath, spacesHandler := v1connect.NewSpacesServiceHandler(
		SpacesService,
		connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
	)
	mountConnectHandler(mux, spacesPath, spacesHandler)
	workspacesPath, workspacesHandler := v1connect.NewWorkspacesServiceHandler(
		WorkspacesService,
		connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
	)
	mountConnectHandler(mux, workspacesPath, workspacesHandler)
	usersPath, usersHandler := v1connect.NewUsersServiceHandler(
		UsersService,
		connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
	)
	mountConnectHandler(mux, usersPath, usersHandler)
	filePath, fileHandler := v1connect.NewFileServiceHandler(
		FileService,
		connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
	)
	mountConnectHandler(mux, filePath, fileHandler)
	conversationsPath, conversationsHandler := v1connect.NewConversationServiceHandler(
		ConversationsService,
		connect.WithInterceptors(auth.FirebaseInterceptor(firebaseAuth)),
	)
	mountConnectHandler(mux, conversationsPath, conversationsHandler)
	// Http service endpoints for HLS video serving
	mux.HandleFunc("GET /video", ProjectService.GetManifest)
	mux.Handle(
		"GET /segments/",
		http.StripPrefix("/segments/", http.FileServer(http.Dir("segments"))),
	)
	slog.Info("startup successful", "port", address)

	// Internal services are initialized as pure grpc services since they do not
	// require http handling
	go runInternalServices(dbgen.New(db))

	http.ListenAndServe(
		address,
		cors.AllowAll().Handler(mux),
	)
}
