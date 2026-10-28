#!/bin/sh
# Exercise hostname resolution and private-address policy on a disposable internal network.
set -eu
cleanup() {
  docker rm -f screenshot-policy-target screenshot-policy-false screenshot-policy-true >/dev/null 2>&1 || true
  docker network rm screenshot-policy-test >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create --internal screenshot-policy-test >/dev/null
docker run -d --name screenshot-policy-target --network screenshot-policy-test \
  --entrypoint python screenshot-api:ci -m http.server 80 >/dev/null
for mode in false true; do
  docker run -d --name "screenshot-policy-$mode" --network screenshot-policy-test \
    -e "ALLOW_PRIVATE_TARGETS=$mode" screenshot-proxy:ci >/dev/null
done
docker run --rm --network screenshot-policy-test --entrypoint python screenshot-api:ci -c '
import time
from urllib.request import ProxyHandler, build_opener
from urllib.error import HTTPError, URLError
def status(opener, url):
    deadline = time.monotonic() + 10
    while True:
        try:
            with opener.open(url, timeout=2) as response:
                return response.status
        except HTTPError as error:
            return error.code
        except URLError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(.1)
for mode, expected in (("false", 403), ("true", 200)):
    opener = build_opener(ProxyHandler({"http": f"http://screenshot-policy-{mode}:3128"}))
    assert status(opener, "http://screenshot-policy-target/") == expected, mode
    assert status(opener, "http://169.254.169.254/") == 403, mode
print("Proxy: private hostnames denied by default, explicit opt-in succeeds, metadata always denied")
'
