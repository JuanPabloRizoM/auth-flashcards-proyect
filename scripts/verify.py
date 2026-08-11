#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    "AGENTS.md", "CLAUDE.md", "CHECKPOINTS.md", "init.sh",
    "progress/current.md", "progress/history.md",
    "docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/CONVENTIONS.md",
    "docs/DESIGN.md", "docs/DATABASE.md", "docs/TESTING.md",
    "docs/VERIFICATION.md", "docs/SECURITY.md",
    ".harness/config.json",
    ".harness/tasks/TASK-TEMPLATE.json",
    ".harness/contracts/CONTRACT-TEMPLATE.json",
    ".harness/agents/planner.md",
    ".harness/agents/implementer.md",
    ".harness/agents/reviewer.md",
    ".harness/agents/qa.md",
]

for rel in required:
    if not (ROOT / rel).exists():
        errors.append(f"Falta: {rel}")

try:
    config = json.loads((ROOT / ".harness/config.json").read_text(encoding="utf-8"))
    valid_states = set(config["states"])
except Exception as exc:
    errors.append(f"config inválida: {exc}")
    valid_states = set()

tasks = {}
active = []

for path in sorted((ROOT / ".harness/tasks").glob("*.json")):
    if path.name == "TASK-TEMPLATE.json":
        continue
    try:
        task = json.loads(path.read_text(encoding="utf-8"))
        for field in [
            "id", "title", "status", "goal",
            "confirmed_requirements", "open_questions",
            "acceptance", "allowed_paths", "required_docs"
        ]:
            if field not in task:
                errors.append(f"{path.name}: falta {field}")
        if valid_states and task.get("status") not in valid_states:
            errors.append(f"{path.name}: estado inválido {task.get('status')}")
        tasks[task["id"]] = task
        if task.get("status") in {
            "PLANNING", "READY", "IMPLEMENTING", "VERIFYING",
            "REVIEWING", "QA", "TEST_FAILED", "REVIEW_FAILED", "QA_FAILED"
        }:
            active.append(task["id"])
    except Exception as exc:
        errors.append(f"{path.name}: JSON inválido: {exc}")

if len(active) > 1:
    errors.append("Más de una tarea activa: " + ", ".join(active))

for tid, task in tasks.items():
    if task["status"] in {
        "READY", "IMPLEMENTING", "VERIFYING",
        "REVIEWING", "QA", "DONE", "TEST_FAILED",
        "REVIEW_FAILED", "QA_FAILED"
    }:
        contract = ROOT / ".harness/contracts" / f"{tid}.json"
        if not contract.exists():
            errors.append(f"{tid}: falta contrato antes de {task['status']}")

if errors:
    print("VERIFY: FAIL")
    for error in errors:
        print("- " + error)
    sys.exit(1)

print("VERIFY: OK")
print("- estructura base")
print("- cero tareas es válido")
print("- máximo una tarea activa")
print("- el usuario controla qué tarea existe/sigue")
print("- contrato obligatorio antes de implementación")
