#!/usr/bin/env python3
"""Private-development overlay; never changes repository public/ or dist/."""
from pathlib import Path
import shutil

root = Path('/var/www/imagine-dev-previews/comercial-dev.imaginecomunica.com.br')
backup = Path('/srv/imagine/backups/comercial-before-customer-demo-d01')
backup.mkdir(mode=0o700, exist_ok=True)
script = '<script src="/simulacao/compra/commercial-demo-link.js" defer></script>'
for relative in ['index.html', 'en/index.html', 'es/index.html']:
    target = root / relative
    original = target.read_text()
    snapshot = backup / relative
    if not snapshot.exists():
        snapshot.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, snapshot)
    if script not in original:
        assert original.count('</body>') == 1, 'Unexpected HTML document'
        temporary = target.with_suffix('.html.new')
        temporary.write_text(original.replace('</body>', script+'</body>'))
        temporary.chmod(target.stat().st_mode & 0o777)
        temporary.replace(target)
print('PASS private PT/EN/ES overlay installed; original HTML backed up')
