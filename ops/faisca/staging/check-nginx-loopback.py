#!/usr/bin/env python3
"""R41: ephemeral read-only localhost Nginx smoke for an extracted private kit.

Requires system nginx and htpasswd; never starts Docker, connects to a VPS,
opens a public socket, writes to the reviewed kit, or uses real credentials.
"""
import argparse
import base64
import hashlib
import json
import os
import pathlib
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

TESTS = (
    ('anonymous_home', 'GET', '/', False, 401, 'DENY'),
    ('authorized_home', 'GET', '/', True, 200, 'DENY'),
    ('anonymous_journey', 'GET', '/__faisca_preview/journey/', False, 401, 'SAMEORIGIN'),
    ('authorized_journey', 'GET', '/__faisca_preview/journey/', True, 200, 'SAMEORIGIN'),
    ('authorized_support', 'GET', '/__faisca_preview/support/', True, 200, 'SAMEORIGIN'),
    ('authorized_bridge', 'GET', '/__faisca_preview/quote-bridge.js', True, 200, 'DENY'),
    ('authorized_post', 'POST', '/__faisca_preview/journey/', True, 403, 'SAMEORIGIN'),
    ('blocked_config', 'GET', '/ops/staging/nginx.conf', True, 404, 'DENY'),
    ('authorized_robots', 'GET', '/robots.txt', True, 200, 'DENY'),
    ('query_frame_denied', 'GET', '/__faisca_preview/journey/?unexpected=1', True, 200, 'DENY'),
    ('authorized_head', 'HEAD', '/__faisca_preview/journey/', True, 200, 'SAMEORIGIN'),
)


def verify_kit(root):
    manifest = json.loads((root / 'Faisca_R38_MANIFEST.json').read_text())
    if (manifest.get('schema') != 'faisca.static-private-staging-kit.v1' or
            manifest.get('status') != 'REVIEW_ONLY_NO_DEPLOY' or
            manifest.get('productionPublished') is not False or
            manifest.get('checkoutEnabled') is not False or
            manifest.get('externalModelEnabled') is not False):
        raise ValueError('Invalid private kit manifest')
    expected = {item['path']: item for item in manifest['files']}
    observed = set()
    for file in root.rglob('*'):
        if file.is_symlink():
            raise ValueError('No symlinks allowed in kit')
        if not file.is_file() or file.name == 'Faisca_R38_MANIFEST.json':
            continue
        name = file.relative_to(root).as_posix()
        if name not in expected:
            raise ValueError('Unexpected file in kit')
        data = file.read_bytes()
        if (expected[name]['bytes'] != len(data) or
                expected[name]['sha256'] != hashlib.sha256(data).hexdigest()):
            raise ValueError('File digest does not match reviewed manifest')
        observed.add(name)
    if observed != set(expected) or len(expected) < 100:
        raise ValueError('Incomplete private review kit')
    return len(observed)


def smoke(root, chromium=False):
    nginx = shutil.which('nginx')
    htpasswd = shutil.which('htpasswd')
    if not nginx or not htpasswd:
        raise RuntimeError('Nginx and htpasswd must already be installed locally')
    count = verify_kit(root)
    with tempfile.TemporaryDirectory(prefix='faisca-r41-smoke-') as workspace:
        temp = pathlib.Path(workspace)
        shutil.copytree(root / 'site', temp / 'site')
        for file in temp.rglob('*'):
            file.chmod(0o755 if file.is_dir() else 0o644)
        temp.chmod(0o755)
        # Ephemeral SYNTHETIC password only; never use a real operator password.
        password = secrets.token_urlsafe(24)
        hashed = subprocess.check_output(
            [htpasswd, '-nbB', '-C', '8', 'reviewer', password],
            text=True, stderr=subprocess.DEVNULL
        )
        auth_file = temp / 'htpasswd'
        auth_file.write_text(hashed)
        auth_file.chmod(0o644)  # Synthetic disposable fixture; no real secret.
        config = (root / 'ops/staging/nginx.conf').read_text()
        required = (
            'map $request_uri $faisca_review_frame {',
            'map $request_uri $faisca_review_ancestors {',
            'listen 8080 default_server;',
            'root /usr/share/nginx/html;',
            'auth_basic_user_file /etc/nginx/auth/.htpasswd;'
        )
        if any(config.count(item) != 1 for item in required):
            raise ValueError('Unreviewed Nginx rule or unsafe frame mapping')
        with socket.socket() as port_socket:
            port_socket.bind(('127.0.0.1', 0))
            port = port_socket.getsockname()[1]
        config = config.replace(
            'listen 8080 default_server;',
            f'listen 127.0.0.1:{port} default_server;'
        ).replace(
            'root /usr/share/nginx/html;', f'root {temp}/site;'
        ).replace(
            '/etc/nginx/auth/.htpasswd', str(auth_file)
        )
        (temp / 'server.conf').write_text(config)
        wrapper = temp / 'nginx.conf'
        wrapper.write_text(
            f'pid {temp}/nginx.pid;\n'
            f'error_log {temp}/nginx.log warn;\n'
            'events { worker_connections 128; }\n'
            f'http {{ include {temp}/server.conf; }}\n'
        )
        check = subprocess.run(
            [nginx, '-t', '-c', str(wrapper)],
            capture_output=True, text=True
        )
        if check.returncode:
            raise RuntimeError('Nginx syntax validation failed')
        server = subprocess.Popen(
            [nginx, '-c', str(wrapper), '-g', 'daemon off;'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        address = f'http://127.0.0.1:{port}'
        auth = 'Basic ' + base64.b64encode(
            f'reviewer:{password}'.encode()
        ).decode()
        try:
            for _ in range(100):
                try:
                    opener.open(address + '/', timeout=.2)
                except urllib.error.HTTPError as error:
                    if error.code == 401:
                        break
                except OSError:
                    pass
                time.sleep(.03)
            success = 0
            for name, method, url, authorized, expected, frame in TESTS:
                request = urllib.request.Request(
                    address + url,
                    headers={'Authorization': auth} if authorized else {},
                    method=method,
                    data=b'' if method == 'POST' else None
                )
                try:
                    with opener.open(request, timeout=4) as response:
                        status = response.status
                        headers = response.headers
                        body = response.read()
                except urllib.error.HTTPError as error:
                    status = error.code
                    headers = error.headers
                    body = error.read()
                policy = headers.get('Content-Security-Policy', '')
                passed = (
                    status == expected and
                    headers.get('X-Frame-Options') == frame and
                    'noindex' in headers.get('X-Robots-Tag', '') and
                    not headers.get('Set-Cookie')
                )
                if authorized and status == 200:
                    passed = passed and (
                        "connect-src 'none'" in policy and
                        "form-action 'none'" in policy
                    )
                if name == 'authorized_home':
                    passed = (passed and b'data-faisca-private-entry' in body and
                              "frame-ancestors 'none'" in policy)
                if name in ('authorized_journey', 'authorized_support'):
                    passed = passed and "frame-ancestors 'self'" in policy
                if name == 'authorized_bridge':
                    passed = passed and b'data-faisca-quote-site' in body
                if name == 'authorized_head':
                    passed = passed and not body
                if name == 'anonymous_home':
                    passed = passed and 'Basic' in headers.get('WWW-Authenticate','')
                success += bool(passed)
                print(f'{"PASS" if passed else "FAIL"} {name}: {status}')
            print(f'R41 localhost Nginx: {success}/{len(TESTS)}, {count} verified files; NO DEPLOY')
            if success != len(TESTS):
                raise RuntimeError('Nginx private HTTP contract failed')

            # R43: all reviewed site bytes must be served byte-for-byte by
            # the actual authenticated Nginx, not merely return HTTP 200.
            manifest = json.loads((root / 'Faisca_R38_MANIFEST.json').read_text())
            site_files = [
                file for file in manifest['files'] if file['path'].startswith('site/')
            ]
            mime_for_extension = {
                '.html': ('text/html',),
                '.js': ('application/javascript', 'text/javascript'),
                '.css': ('text/css',),
                '.txt': ('text/plain',),
                '.xml': ('application/xml', 'text/xml'),
                '.png': ('image/png',)
            }
            matched = 0
            for file in site_files:
                name = file['path'][5:]
                if name == '404.html':
                    uri, expected_code = '/__faisca_r43_missing_route__', 404
                elif name == 'index.html':
                    uri, expected_code = '/', 200
                elif name.endswith('/index.html'):
                    uri, expected_code = '/' + name[:-len('index.html')], 200
                else:
                    uri, expected_code = '/' + name, 200
                request = urllib.request.Request(
                    address + uri, headers={'Authorization': auth}, method='GET'
                )
                try:
                    with opener.open(request, timeout=4) as response:
                        code = response.status
                        response_headers = response.headers
                        data = response.read()
                except urllib.error.HTTPError as error:
                    code = error.code
                    response_headers = error.headers
                    data = error.read()
                dot = name.rfind('.')
                ext = name[dot:].lower() if dot >= 0 else ''
                allowed_mime = mime_for_extension.get(ext)
                if allowed_mime is None or response_headers.get_content_type() not in allowed_mime:
                    raise RuntimeError('Nginx served a script or page with unsafe MIME type')
                if (code != expected_code or
                        hashlib.sha256(data).hexdigest() != file['sha256'] or
                        len(data) != file['bytes'] or
                        'noindex' not in response_headers.get('X-Robots-Tag','') or
                        response_headers.get('Set-Cookie')):
                    raise RuntimeError('Nginx served an unreviewed or changed static asset')
                matched += 1
            print(f'R44 Nginx byte and MIME parity: {matched}/{len(site_files)}')
            if matched != len(site_files) or matched < 50:
                raise RuntimeError('Incomplete Nginx static delivery proof')

            # R45: run actual Chromium while this exact temporary Nginx is
            # still listening. Synthetic Basic Auth lives only in child env,
            # not process arguments, logs, artifacts or the reviewed bundle.
            if chromium:
                env = os.environ.copy()
                env['FAISCA_R45_ORIGIN'] = address
                env['FAISCA_R45_SYNTHETIC_PASSWORD'] = password
                child = subprocess.run(
                    ['node', 'ops/faisca/staging/nginx-browser-qa.mjs'],
                    env=env, timeout=100, check=False
                )
                if child.returncode:
                    raise RuntimeError('R45 Chromium Nginx validation failed')
        finally:
            server.terminate()
            try:
                server.wait(timeout=4)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--kit', required=True,
        help='Directory of an EXTRACTED, independently reviewed R38/R41 staging kit')
    parser.add_argument('--chromium', action='store_true',
        help='Also verify the same temporary Nginx in a real browser')
    opts = parser.parse_args()
    try:
        smoke(pathlib.Path(opts.kit).resolve(), chromium=opts.chromium)
    except Exception as error:
        print('R41 HOLD:', type(error).__name__, str(error), file=sys.stderr)
        sys.exit(2)
