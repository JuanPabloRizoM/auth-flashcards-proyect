#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
TASKS = ROOT / ".harness/tasks"
CONTRACTS = ROOT / ".harness/contracts"

ACTIVE = {
    "PLANNING", "READY", "IMPLEMENTING", "VERIFYING",
    "REVIEWING", "QA", "TEST_FAILED", "REVIEW_FAILED", "QA_FAILED"
}

def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

def real_tasks() -> list[dict]:
    result = []
    for path in sorted(TASKS.glob("*.json")):
        if path.name == "TASK-TEMPLATE.json":
            continue
        result.append(load(path))
    return result

def relevant_docs(task: dict) -> list[str]:
    # required_docs is the source of truth. The planner sets it.
    docs = list(task.get("required_docs", []))
    # Architecture/conventions are mandatory for implementation even if omitted accidentally.
    if task.get("status") in {
        "READY", "IMPLEMENTING", "VERIFYING", "REVIEWING",
        "QA", "TEST_FAILED", "REVIEW_FAILED", "QA_FAILED"
    }:
        for required in ("docs/ARCHITECTURE.md", "docs/CONVENTIONS.md"):
            if required not in docs:
                docs.insert(0, required)
    return list(dict.fromkeys(docs))

def main() -> int:
    tasks = real_tasks()
    active = [t for t in tasks if t.get("status") in ACTIVE]

    print("=== HARNESS CONTEXT ===")

    if len(active) > 1:
        print("ALERTA: hay más de una tarea activa. No implementes.")
        return 0

    if not tasks:
        print("TAREA: ninguna creada.")
        print("ROADMAP: no inferir ni crear tareas futuras.")
        print("ANTES DE PLANIFICAR UNA PETICIÓN:")
        print("- leer AGENTS.md")
        print("- leer progress/current.md")
        print("- leer docs/PRODUCT.md")
        print("- crear UNA task desde .harness/tasks/TASK-TEMPLATE.json")
        print("- registrar requisitos confirmados y preguntas abiertas")
        print("SIGUIENTE: esperar/usar la petición concreta del usuario.")
        print("=== FIN CONTEXT ===")
        return 0

    selected = active[0] if active else None

    if selected is None:
        pending = [t for t in tasks if t.get("status") == "PENDING"]
        if len(pending) == 1:
            selected = pending[0]
        elif len(pending) > 1:
            print("No hay tarea activa y existen varias PENDING.")
            print("No elijas por prioridad automáticamente: el usuario dirige cuál sigue.")
            for t in pending:
                print(f"- {t.get('id')}: {t.get('title')}")
            print("=== FIN CONTEXT ===")
            return 0
        else:
            print("No hay tarea activa.")
            print("No inventes la siguiente feature.")
            print("=== FIN CONTEXT ===")
            return 0

    tid = selected["id"]
    print(f"TAREA: {tid} — {selected.get('title','')}")
    print(f"ESTADO: {selected.get('status')}")
    print(f"OBJETIVO: {selected.get('goal','')}")

    oq = selected.get("open_questions", [])
    if oq:
        print("PREGUNTAS ABIERTAS:")
        for item in oq:
            print(f"- {item}")

    print("ACEPTACIÓN:")
    for item in selected.get("acceptance", []):
        print(f"- {item}")

    contract = CONTRACTS / f"{tid}.json"
    print(f"CONTRATO: {'OK' if contract.exists() else 'FALTA'}")

    print("LECTURA OBLIGATORIA AHORA:")
    print("- AGENTS.md")
    print("- progress/current.md")
    print(f"- .harness/tasks/{tid}.json")
    if contract.exists():
        print(f"- .harness/contracts/{tid}.json")
    for doc in relevant_docs(selected):
        print(f"- {doc}")

    print("NO LEER POR DEFECTO:")
    print("- progress/history.md salvo necesidad explícita")
    print("- documentación no listada arriba")
    print("- archivos del código sin relación con la tarea")

    print("REGLAS:")
    print("- usuario dirige roadmap")
    print("- no asumir decisiones no confirmadas")
    print("- una tarea a la vez")
    print("- ./init.sh verde antes de editar")
    print("- no salir de allowed_paths")
    print("- acceptance congelado al empezar implementación")
    print("- cada acceptance necesita evidencia")
    print("- reviewer/QA read-only")
    print("=== FIN CONTEXT ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())
