FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends squid socat ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 screenshot \
    && usermod -a -G screenshot proxy \
    && mkdir -p /run/egress \
    && chown proxy:screenshot /run/egress \
    && chmod 2770 /run/egress
COPY deploy/squid.conf /etc/squid/squid.conf
COPY deploy/proxy-entrypoint.sh /usr/local/bin/proxy-entrypoint.sh
USER proxy
EXPOSE 3128
CMD ["bash", "/usr/local/bin/proxy-entrypoint.sh"]
