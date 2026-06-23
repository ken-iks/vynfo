## Vynfo project
#### Hopefully will be a pretty cool video editor once I can get it to work

#### Deployed architecture

As currently constructed, the service backend is deployed on Google Cloud Run (see `deploy/cloud-run/chichi-service.yaml`).
There are 2 backend processes that run on the chichi service:
1. `chichi/` - which is the core `golang` backend service on `:8080` that does the app heavy lifting, and owns the app data model
2. `mensah/` - which is a `python` sidecar internal service on `:5052` that owns our agent runtime and harness implementation

The frontend service (`eden/`) is a `vite` single page web application written in `typescript` (react). This app is hosted on Google Firebase (see `eden/firebase.json`) and firebase also acts as our auth layer too. Firebase Hosting only serves the static SPA and falls back to `index.html`; it does not proxy backend API traffic.

Frontend traffic is routed in this manner:
```
Client => Cloudflare Proxy => Firebase Hosting
```

Backend traffic is routed through `api.vynfo.com`:
```
Client => Cloudflare Proxy => Cloud Run
```

This keeps Firebase Hosting out of the API path, which avoids Firebase buffering streamed responses. `eden` reads the backend origin from `VITE_CHICHI_BASE_URL`; production should set this to `https://api.vynfo.com`.

The Cloud Run service disables its default `run.app` URL and caps max scale at 1. Public backend access should go through Cloudflare-managed custom domains, with `api.vynfo.com` mapped to Cloud Run by a proxied `CNAME api -> ghs.googlehosted.com` DNS record.

#### Getting set up


1. Make sure to have access credentials by generating an ssh key and adding it to the github. From there, `git clone` the repo so you have it local
2. Install the base dependencies `brew install go node buf ffmpeg uv`
3. Add the Go bin to PATH: `echo 'export PATH="$HOME/go/bin:$PATH"' >> ~/.zshrc`
4. Ensure you have docker desktop downloaded (can install from website or use `brew install --cask docker`)
5. Generate and store access google app credentials and set up **.env** file with accurate path (TBD). NOTE **make sure .env file lives in the chichi/ directory**

6. Download frontend package manager: `npm install -g pnpm`

7. Download Go CLI Tools:
```
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/segmentio/golines@latest
```

8. Get Go module deps `cd chichi && go mod download`

9. Get node module deps `cd edent && pnpm i`

10. Get Python service deps `cd mensah && uv sync`

11. Run `buf generate` to generate the API clients and internal gRPC stubs

Now youre all set up! See the makefile for useful commands or see below! Happy hacking.


#### Useful commands

- Run `buf generate` to regenerate protos
- Run `buf lint` to lint the protos
- Run `make format` from the root to run formatters for both directories, or run it from within each to individually format

Chichi commands:

Generate chichi sql models:
Requirement: `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`
Run: `sqlc generate`
If you get command not found for the above, try this: `export PATH="$(go env GOPATH)/bin:$PATH"` then re run

Spin up the local postgres volume:
`docker compose up -d`

Poke around the volume data:
`docker compose exec postgres psql -U dev -d vynfo`

Clear the volume data:
`docker compose down -v`

Run local db migration:
`goose -dir database/schema postgres "postgres://dev:dev@localhost:5432/vynfo?sslmode=disable" up`

To run linter:
golangci-lint run ./...

Eden commands:

Add shadcn components:
`pnpm dlx shadcn@latest add X`
