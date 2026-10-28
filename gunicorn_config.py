bind = '0.0.0.0:8080'
workers = 2
timeout = 60


def on_starting(server):
    from app import settings
    settings()
