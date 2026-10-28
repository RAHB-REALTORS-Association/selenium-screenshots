bind = '0.0.0.0:8080'
workers = 2
worker_class = 'gthread'
threads = 4
preload_app = True
timeout = 65


def on_starting(server):
    from app import settings
    settings()
