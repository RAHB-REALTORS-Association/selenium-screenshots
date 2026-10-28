FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends squid ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY deploy/squid.conf /etc/squid/squid.conf
COPY deploy/proxy-entrypoint.sh /usr/local/bin/proxy-entrypoint.sh
USER proxy
EXPOSE 3128
CMD ["sh", "/usr/local/bin/proxy-entrypoint.sh"]
