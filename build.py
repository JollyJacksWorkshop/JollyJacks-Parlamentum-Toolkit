"""Rebuild the self-contained offline HTML and Windows-embedded index.
All inputs are checked into this source directory. No network access required.
"""
from pathlib import Path
import base64
here=Path(__file__).resolve().parent
assets=here/'assets'
old=(assets/'index.html').read_text(encoding='utf-8')
start=old.index('<svg width="0"')
svg=old[start:old.index('</svg>',start)+6]
img=(assets/'brand.webp').read_bytes()
brand='data:image/webp;base64,'+base64.b64encode(img).decode()
css=(assets/'style.css').read_text();app=(assets/'app.js').read_text().replace('__BRAND__',brand)
engine=(assets/'engine.js').read_text()
html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#100e12"><title>JollyJack's Parlamentum Toolkit V1.1</title><style>{css}</style></head><body>{svg}
<div class="shell" id="app"><aside class="sidebar"><div class="brand"><img src="{brand}" alt="JollyJack's Gilded Smoke logo"><div><div class="brand-title">JollyJack's<br>Toolkit</div><div class="brand-sub">Parlamentum V1.1</div></div></div><div class="nav" id="navigation"></div><div class="side-footer"><span class="chip">VERSION 1.1</span><p style="font-size:11px;margin-top:9px">Offline planning, supply chains and calculators. No game-account connection.</p></div></aside><div class="content"><header class="topbar"><div class="crumb" id="breadcrumb">DASHBOARD</div><div class="topright"><span id="save-status">Saved on this device</span><span class="chip dim">Offline</span></div></header><main class="main" id="main"></main></div></div>
<div id="modal-host"></div><div id="toast" class="toast hide" role="status"></div><input type="file" id="file-chain" accept=".json,application/json" hidden><input type="file" id="file-backup" accept=".json,application/json" hidden><script>{engine}</script><script>{app}</script></body></html>'''
for target in [here.parent/"JollyJacks_Parlamentum_Toolkit_V1.1.html",assets/'index.html']:
 target.write_text(html,encoding='utf-8')
print('HTML',len(html),'logo',len(img),'engine',len(engine),'app',len(app))
