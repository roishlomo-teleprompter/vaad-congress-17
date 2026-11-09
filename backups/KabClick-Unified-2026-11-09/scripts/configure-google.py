#!/usr/bin/env python3
"""Configure public iOS OAuth credentials. No client secret is required."""
import argparse, pathlib, plistlib, re
parser=argparse.ArgumentParser()
parser.add_argument('--client-id',required=True)
a=parser.parse_args()
if not re.fullmatch(r'[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', a.client_id):
    parser.error('Expected the client ID of an iOS OAuth client')
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'ios/App/App/Info.plist'
with p.open('rb') as f: d=plistlib.load(f)
d['GIDClientID']=a.client_id
d['CFBundleURLTypes']=[{'CFBundleTypeRole':'Editor','CFBundleURLSchemes':['.'.join(reversed(a.client_id.split('.')))]}]
# Google reverses the domain, keeping the numeric client prefix intact.
d['CFBundleURLTypes'][0]['CFBundleURLSchemes']=['com.googleusercontent.apps.'+a.client_id.removesuffix('.apps.googleusercontent.com')]
with p.open('wb') as f: plistlib.dump(d,f,sort_keys=False)
print('Configured iOS OAuth client and URL scheme. No secret stored.')
