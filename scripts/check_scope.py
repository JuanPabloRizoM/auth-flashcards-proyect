#!/usr/bin/env python3
from __future__ import annotations
import fnmatch, json, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TASKS=ROOT/".harness/tasks"
ACTIVE={"IMPLEMENTING","VERIFYING","REVIEWING","QA","TEST_FAILED","REVIEW_FAILED","QA_FAILED"}

def load(p): return json.loads(p.read_text(encoding="utf-8"))
tasks=[load(p) for p in TASKS.glob("TASK-*.json") if p.name!="TASK-TEMPLATE.json"]
active=[t for t in tasks if t["status"] in ACTIVE]

if not active:
    print("SCOPE: sin tarea de ejecución activa")
    raise SystemExit(0)

task=active[0]
patterns=task.get("allowed_paths",[])
always=[".harness/**","docs/**","progress/**","scripts/**","AGENTS.md","CLAUDE.md","CHECKPOINTS.md","README.md"]

try:
    subprocess.run(["git","rev-parse","--is-inside-work-tree"],cwd=ROOT,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
except Exception:
    print("SCOPE: Git no inicializado; omitido")
    raise SystemExit(0)

p=subprocess.run(["git","status","--porcelain"],cwd=ROOT,check=True,capture_output=True,text=True)
changed=[]
for line in p.stdout.splitlines():
    if not line: continue
    path=line[3:]
    if " -> " in path: path=path.split(" -> ",1)[1]
    changed.append(path)

def match(path,pattern):
    if pattern.endswith("/**") and path.startswith(pattern[:-3] + "/"):
        return True
    return fnmatch.fnmatch(path,pattern)

bad=[p for p in changed if not any(match(p,pat) for pat in patterns+always)]
if bad:
    print(f"SCOPE: FAIL ({task['id']})")
    for p in bad: print(f"- fuera de scope: {p}")
    raise SystemExit(2)

print(f"SCOPE: OK ({task['id']})")
