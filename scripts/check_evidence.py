#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TASKS=ROOT/".harness/tasks"
E=ROOT/"progress/evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))
errors=[]

for p in TASKS.glob("TASK-*.json"):
    if p.name=="TASK-TEMPLATE.json": continue
    t=load(p); tid=t["id"]; s=t["status"]

    if s in {"REVIEWING","QA","DONE"} and not (E/f"{tid}-implementation.md").exists():
        errors.append(f"{tid}: falta implementation evidence")

    if s in {"QA","DONE"} and not (E/f"{tid}-review.md").exists():
        errors.append(f"{tid}: falta review evidence")

    if s=="DONE" and not (E/f"{tid}-qa.md").exists():
        errors.append(f"{tid}: falta QA evidence")

if errors:
    print("EVIDENCE: FAIL")
    for e in errors: print("- "+e)
    raise SystemExit(1)

print("EVIDENCE: OK")
