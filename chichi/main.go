package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"cloud.google.com/go/storage"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	"vynfo.com/vynfo/services"
)

const address = ":8080"

func main() {
	godotenv.Load()
	// slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})))
	ctx := context.Background()
	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		os.Exit(1)
	}
	defer storageClient.Close()
	VideoService := services.NewVideoServiceServer(storageClient)
	mux := http.NewServeMux()
	mux.Handle(v1connect.NewVideoServiceHandler(VideoService))
	mux.HandleFunc("GET /video", VideoService.GetManifest)
	mux.Handle(
		"GET /segments/",
		http.StripPrefix("/segments/", http.FileServer(http.Dir("segments"))),
	)
	fmt.Println("... Listening on", address)
	http.ListenAndServe(
		address,
		cors.AllowAll().Handler(mux),
	)
}
