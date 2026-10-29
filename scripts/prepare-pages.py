#!/usr/bin/env python3
"""Prepare the static site using the checked-in assets; no Node/package manager.
Games, covers and the catalog come from this repository's games/ folder.
"""
import argparse,json,shutil,pathlib,hashlib,re
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--games',type=pathlib.Path,default=root/'games');p.add_argument('--output',type=pathlib.Path,required=True);args=p.parse_args()
output=args.output.resolve();games=args.games.resolve()
if output==root or root in output.parents or output==games or games in output.parents:raise SystemExit('Choose an output directory outside the repository.')
if output.exists() and any(output.iterdir()):raise SystemExit('Output directory must be empty.')
manifest=json.loads((games/'manifest.json').read_text())
for required in ['vendor/scramjet/scramjet.js','vendor/controller/controller.api.js','vendor/v86/libv86.mjs','vendor/v86/alpine.iso','sw.js']:
 if not (root/'public'/required).is_file():raise SystemExit('Missing checked-in runtime: '+required)
# Source maps and type-build leftovers are only for debugging; visitors never download them.
shutil.copytree(root/'public',output,ignore=shutil.ignore_patterns('*.map','temp-types-build'),dirs_exist_ok=True)
shutil.copytree(games,output/'games',dirs_exist_ok=True)
# The catalog is fetched on every visit, so store it without whitespace or the
# import bookkeeping (where each record was found) that the site never reads.
private={'catalogSources','provenance','author','revision'}
public=[{k:v for k,v in g.items() if k not in private} for g in manifest]
(output/'games'/'manifest.json').write_text(json.dumps(public,separators=(',',':'),ensure_ascii=False))
config=json.loads((root/'public/pages-config.json').read_text());config['mode']='static'
(output/'site-config.js').write_text('// Generated public configuration; never include secrets.\nexport default '+json.dumps(config,indent=2)+';\n')
# One version across the small first-party module graph prevents stale dependent
# modules/config after publication. Vendor/VM files remain lazy and pinned.
first_party=sorted([*output.glob('*.js'),*output.glob('*.css')])
release=hashlib.sha256(b''.join(p.name.encode()+p.read_bytes() for p in first_party)+(games/'manifest.json').read_bytes()).hexdigest()[:12]
imports=re.compile(r"((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['\"])(\./[^'\"?]+\.(?:js|mjs))(?:\?[^'\"]*)?(['\"])")
for file in output.glob('*.js'):
 if file.name=='sw.js':continue
 file.write_text(imports.sub(lambda m:m[1]+m[2]+'?v='+release+m[3],file.read_text()))
index=output/'index.html'
html=re.sub(r'src="\./app\.js(?:\?[^"]*)?"','src="./app.js?v='+release+'"',index.read_text())
html=re.sub(r'href="(\./(?:style|library|galaxy)\.css)(?:\?[^"]*)?"',lambda m:'href="'+m[1]+'?v='+release+'"',html)
index.write_text(html)
shutil.copy(root/'LICENSE',output/'LICENSE');(output/'.nojekyll').touch()
print(f'Static Pages output: {output}; {len(manifest)} catalog records. No backend is needed for the core site.')

editor=output/'edit.html'
editor.write_text(editor.read_text().replace('./edit.js','./edit.js?v='+release).replace('./style.css','./style.css?v='+release).replace('./library.css','./library.css?v='+release).replace('./galaxy.css','./galaxy.css?v='+release).replace('./edit.css','./edit.css?v='+release))
