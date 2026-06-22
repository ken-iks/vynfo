FROM golang:1.25-bookworm AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/chichi .

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=build /out/chichi /app/chichi

EXPOSE 8080

CMD ["/app/chichi"]
