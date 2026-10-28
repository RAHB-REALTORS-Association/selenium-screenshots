"""Carry the browser's local HTTP proxy connection over a Unix socket, without IP egress."""
import argparse
import select
import socket
import socketserver


class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as upstream:
            upstream.settimeout(60)
            self.request.settimeout(60)
            try:
                upstream.connect(self.server.upstream_path)
                peers = {upstream: self.request, self.request: upstream}
                while peers:
                    ready, _, _ = select.select(list(peers), [], [], 60)
                    if not ready:
                        return
                    for source in ready:
                        data = source.recv(65536)
                        if data:
                            peers[source].sendall(data)
                        else:
                            peers[source].shutdown(socket.SHUT_WR)
                            del peers[source]
            except OSError:
                return


class ProxyServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--socket', required=True)
    arguments = parser.parse_args()
    with ProxyServer(('127.0.0.1', 3128), Relay) as server:
        server.upstream_path = arguments.socket
        server.serve_forever()
