"""Regenerate assets/manifest.js from image files in assets/."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
folder = root / 'assets'
images = sorted((p for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}), key=lambda p: p.name.lower())
def url(path):
    return '/'.join(part.replace(' ', '%20') for part in path.relative_to(root).parts)
def is_capsule(path):
    return any(word in path.stem.lower() for word in ('capsule', 'header', 'cover'))
capsule = next((p for p in images if is_capsule(p)), None)
gallery = [url(p) for p in images if p != capsule]
payload = {'capsule': url(capsule) if capsule else None, 'gallery': gallery}
(folder / 'manifest.js').write_text('window.STORE_ASSETS = ' + json.dumps(payload, indent=2) + ';\n', encoding='utf-8')
print(f'Indexed {len(gallery)} gallery images' + (' and a capsule image' if capsule else ''))
