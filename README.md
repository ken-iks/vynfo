## Vynfo project
#### Hopefully will be a pretty cool video editor once I can get it to work

- Run `buf generate` to regenerate protos
- Run `buf lint` to lint the protos
- Run `make format` from the root to run formatters for both directories, or run it from within each to individually format

Chichi commands:

Generate chichi sql models:
Requirement: `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`
Run: `sqlc generate`

Spin up the local postgres volume:
`docker compose up -d`

Poke around the volume data:
`docker compose exec postgres psql -U dev -d vynfo`

Clear the volume data:
`docker compose down -v`

Run local db migration:
`goose -dir database/schema postgres "postgres://dev:dev@localhost:5432/vynfo?sslmode=disable" up`

