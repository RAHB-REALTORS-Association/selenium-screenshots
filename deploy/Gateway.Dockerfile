FROM nginx/nginx-unprivileged:1.30.8-alpine@sha256:637c35e46af7bc0dd3d3bcf7162e004e13ab3b370fde7cd416e2ac410b5a985a
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/gateway.conf /etc/nginx/conf.d/default.conf
