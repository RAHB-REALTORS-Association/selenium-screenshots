import os

bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:8080').split(',')
umask = 0o007
workers = 2
worker_class = 'gthread'
threads = 4
preload_app = True
timeout = 65
graceful_timeout = 60


def on_starting(server):
    from app import settings
    settings()
