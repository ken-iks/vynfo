package users

import (
	"vynfo.com/vynfo/gen/proto/v1/v1connect"
	dbgen "vynfo.com/vynfo/internal/db"
)

type UsersServiceServer struct {
	v1connect.UnimplementedUsersServiceHandler
	queries *dbgen.Queries
}

func NewUsersServiceServer(queries *dbgen.Queries) *UsersServiceServer {
	return &UsersServiceServer{queries: queries}
}
