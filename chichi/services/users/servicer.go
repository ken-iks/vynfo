package users

import (
	"cloud.google.com/go/storage"
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
)

type UsersServiceServer struct {
	v1connect.UnimplementedUsersServiceHandler
	storageClient *storage.Client
	queries       *dbgen.Queries
}

func NewUsersServiceServer(
	storageClient *storage.Client,
	queries *dbgen.Queries,
) *UsersServiceServer {
	return &UsersServiceServer{
		storageClient: storageClient,
		queries:       queries,
	}
}
