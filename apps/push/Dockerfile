FROM golang:1.26-alpine AS builder

ARG UPSTREAM_REPO=https://github.com/xmtp/example-notification-server-go.git
ARG UPSTREAM_COMMIT=0b22838ede4d0b550a3ea2c8465446ed2ce02bc2

RUN apk add --no-cache build-base git

WORKDIR /src
RUN git clone --filter=blob:none "$UPSTREAM_REPO" . \
  && git checkout --detach "$UPSTREAM_COMMIT"

RUN go build \
  -o /out/notifications-server \
  -ldflags="-X 'main.GitCommit=$UPSTREAM_COMMIT'" \
  cmd/server/main.go

FROM alpine:3

LABEL source="https://github.com/xmtp/example-notification-server-go"
LABEL description="XMTP notification server for Stage (contentless push relay)"

RUN apk add --no-cache ca-certificates
ENV GOLOG_LOG_FMT=nocolor

COPY --from=builder /out/notifications-server /usr/bin/notifications-server
COPY entrypoint.sh /usr/bin/stage-push-entrypoint
RUN chmod +x /usr/bin/stage-push-entrypoint

EXPOSE 8080
ENTRYPOINT ["/usr/bin/stage-push-entrypoint"]
