#!/usr/bin/env python3
"""Prepare the static site using the checked-in assets; no Node/package manager.
Game payloads remain sourced from the separate vex-games checkout.
"""
import argparse,json,shutil,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--games',type=pathlib.Path,default=root.parent/'vex-games');p.add_argument('--output',type=pathlib.Path,required=True);args=p.parse_args()
output=args.output.resolve();games=args.games.resolve()
if output==root or root in output.parents or output==games or games in output.parents:raise SystemExit('Choose an output directory outside both source repositories.')
if output.exists() and any(output.iterdir()):raise SystemExit('Output directory must be empty.')
manifest=json.loads((games/'manifest.json').read_text())
for required in ['vendor/scramjet/scramjet.js','vendor/controller/controller.api.js','vendor/v86/libv86.mjs','vendor/v86/alpine.iso','sw.js']:
 if not (root/'public'/required).is_file():raise SystemExit('Missing checked-in runtime: '+required)
shutil.copytree(root/'public',output,dirs_exist_ok=True)
shutil.copytree(games,output/'content',ignore=shutil.ignore_patterns('.git','.github'),dirs_exist_ok=True)
config=json.loads((root/'public/pages-config.json').read_text());config['mode']='static'
(output/'site-config.js').write_text('// Generated public configuration; never include secrets.\nexport default '+json.dumps(config,indent=2)+';\n')
shutil.copy(root/'LICENSE',output/'LICENSE');(output/'.nojekyll').touch()
workflow=output/'.github/workflows';workflow.mkdir(parents=True,exist_ok=True)
shutil.copy(root/'.github/workflows/pages.yml',workflow/'pages.yml')
print(f'Static Pages output: {output}; {len(manifest)} catalog records. No backend is needed for the core site.')
