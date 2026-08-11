#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
H = ROOT / ".harness"
TASKS = H / "tasks"
CONFIG = H / "config.json"

def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

def save(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)

def task_path(task_id: str) -> Path:
    return TASKS / f"{task_id}.json"

def get_task(task_id: str) -> dict:
    path = task_path(task_id)
    if not path.exists():
        raise SystemExit(f"No existe {task_id}")
    return load(path)

def real_tasks() -> list[dict]:
    result = []
    for path in sorted(TASKS.glob("*.json")):
        if path.name == "TASK-TEMPLATE.json":
            continue
        result.append(load(path))
    return result

def list_tasks() -> None:
    tasks = real_tasks()
    if not tasks:
        print("No hay tareas. El usuario todavía no ha definido una.")
        return
    for task in tasks:
        print(f"{task['id']:10} {task['status']:16} {task['title']}")

def create_from_template(task_id: str) -> None:
    if not task_id.startswith("TASK-"):
        raise SystemExit("Usa un id como TASK-001")
    target = task_path(task_id)
    if target.exists():
        raise SystemExit(f"{task_id} ya existe")
    data = load(TASKS / "TASK-TEMPLATE.json")
    data["id"] = task_id
    save(target, data)
    print(f"Creada plantilla {target.relative_to(ROOT)}")
    print("Ahora complétala SOLO con la petición actual del usuario.")

def set_state(task_id: str, new_state: str) -> None:
    config = load(CONFIG)
    task = get_task(task_id)
    current = task["status"]
    allowed = config["workflow"].get(current, [])

    if new_state not in allowed:
        raise SystemExit(f"Transición no permitida: {current} -> {new_state}")

    if new_state == "READY" and task.get("open_questions"):
        raise SystemExit("No puede pasar a READY mientras existan open_questions.")

    if new_state == "IMPLEMENTING":
        contract = H / "contracts" / f"{task_id}.json"
        if not contract.exists():
            raise SystemExit("Falta contrato.")
        c = load(contract)
        if c.get("open_questions"):
            raise SystemExit("Contrato todavía tiene open_questions.")
        if not c.get("verification_matrix"):
            raise SystemExit("Contrato sin verification_matrix.")

    task["status"] = new_state
    save(task_path(task_id), task)
    print(f"{task_id}: {current} -> {new_state}")

def main() -> int:
    parser = argparse.ArgumentParser(description="User-directed Harness")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list")
    show = sub.add_parser("show")
    show.add_argument("task_id")

    create = sub.add_parser("create")
    create.add_argument("task_id")

    state = sub.add_parser("set-state")
    state.add_argument("task_id")
    state.add_argument("state")

    args = parser.parse_args()

    if args.command == "list":
        list_tasks()
    elif args.command == "show":
        print(json.dumps(get_task(args.task_id), ensure_ascii=False, indent=2))
    elif args.command == "create":
        create_from_template(args.task_id)
    elif args.command == "set-state":
        set_state(args.task_id, args.state)
    return 0

if __name__ == "__main__":
    sys.exit(main())
