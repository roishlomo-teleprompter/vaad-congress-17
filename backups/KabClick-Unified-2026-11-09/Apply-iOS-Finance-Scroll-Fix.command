#!/bin/bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import shutil,re
r=Path.cwd()
assert (r/'www/ios-native.css').is_file(), 'Run from KabClick-Unified'
p=r/'www/index.html'
css=r/'www/ios-native.css'
marker='/* iOS finance footer clearance - Build 282. */'
if marker not in css.read_text():
    assert "const APP_BUILD = '281';" in p.read_text(), 'Expected Build 281. No files changed.'
    backup=r/('backup-before-finance-scroll-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    files=['www/ios-native.css','www/index.html','tests/platform-isolation.cjs','ios/App/App.xcodeproj/project.pbxproj']
    for f in files:
        s=r/f
        if s.exists():
            t=backup/f;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s,t)
    css.write_text(css.read_text()+'\n/* iOS finance footer clearance - Build 282. */\n.ios-native #financeScreen{padding-bottom:calc(260px + env(safe-area-inset-bottom,0px));}\n.ios-native #financeScreen > .finance-card{flex-shrink:0;}\n')
    for f in ['www/index.html','tests/platform-isolation.cjs']:
        s=r/f
        if s.exists():s.write_text(s.read_text().replace("const APP_BUILD = '281';","const APP_BUILD = '282';"))
    s=r/'ios/App/App.xcodeproj/project.pbxproj'
    if s.exists():
        text=s.read_text();versions=re.findall(r'CURRENT_PROJECT_VERSION = (\d+);',text)
        version=max(7,max(map(int,versions))+1)
        s.write_text(re.sub(r'CURRENT_PROJECT_VERSION = \d+;',f'CURRENT_PROJECT_VERSION = {version};',text))
    print('Applied Build 282. Backup:',backup)
else:print('Already applied')
PY
npm test
npm run sync:ios
