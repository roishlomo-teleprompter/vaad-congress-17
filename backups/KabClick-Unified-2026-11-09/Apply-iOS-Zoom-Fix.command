#!/bin/bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import json, re, shutil
root=Path.cwd()
assert (root/'package.json').is_file(), 'Run from KabClick-Unified'
assert json.loads((root/'package.json').read_text()).get('name')=='kabclick-unified', 'Run from KabClick-Unified'
css=root/'www/ios-native.css'
html=root/'www/index.html'
project=root/'ios/App/App.xcodeproj/project.pbxproj'
marker='/* iOS focus zoom - Build 281.'
if marker not in css.read_text():
    assert "const APP_BUILD = '280';" in html.read_text(), 'Expected shared Build 280. No files changed.'
    project_text=project.read_text()
    versions=re.findall(r'CURRENT_PROJECT_VERSION = (\d+);',project_text)
    assert versions, 'iOS build number missing. No files changed.'
    version=max(6,max(map(int,versions))+1)
    paths=[css,html,project,root/'tests/platform-isolation.cjs',root/'SOURCE-PROVENANCE.json']
    backup=root/('backup-before-ios-zoom-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    backup.mkdir()
    for p in paths:
        if p.is_file():
            target=backup/p.relative_to(root)
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(p,target)
    css.write_text(css.read_text()+'''
/* iOS focus zoom - Build 281. Must override later inline application styles. */
.ios-native input:not([type=checkbox]):not([type=radio]),
.ios-native select,
.ios-native textarea{font-size:16px !important;}
''')
    html.write_text(html.read_text().replace("const APP_BUILD = '280';","const APP_BUILD = '281';"))
    project.write_text(re.sub(r'CURRENT_PROJECT_VERSION = \d+;',f'CURRENT_PROJECT_VERSION = {version};',project_text))
    test=root/'tests/platform-isolation.cjs'
    if test.is_file():test.write_text(test.read_text().replace("const APP_BUILD = '280';","const APP_BUILD = '281';"))
    meta=root/'SOURCE-PROVENANCE.json'
    if meta.is_file():
        data=json.loads(meta.read_text());data['sharedWebBuild']=281;data['ios']['build']=version
        meta.write_text(json.dumps(data,indent=2)+'\n')
    print('Applied iOS input focus fix. Build 281; iOS build',version)
    print('Backup:',backup)
else:
    print('iOS focus fix already applied.')
PY
npm test
npm run sync:ios
echo "Stop and Run in Xcode. Test customer search, dismiss keyboard, then check page width."
