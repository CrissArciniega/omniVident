#!/usr/bin/env python3
"""
Entry point CLI para el pipeline de contenido.

Uso:
    # Pipeline completo
    python run_pipeline.py --full

    # Fase especifica
    python run_pipeline.py --phase 1
    python run_pipeline.py --phase 2
    python run_pipeline.py --phase 3
    python run_pipeline.py --phase 4
    python run_pipeline.py --phase 5

    # Ver estado
    python run_pipeline.py --status

    # Scheduler automatico (quincenal)
    python run_pipeline.py --schedule
"""

import argparse
import json
import sys
from pathlib import Path

# Agregar el directorio raiz al path
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))


def main() -> None:
    """Entry point principal del CLI."""
    parser = argparse.ArgumentParser(
        description="Pipeline de Contenido para RRSS - Productos Importados de China",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python run_pipeline.py --full          Ejecutar pipeline completo (fases 1-5)
  python run_pipeline.py --phase 1       Solo keyword research
  python run_pipeline.py --phase 3       Solo generacion de scripts
  python run_pipeline.py --status        Ver estado del ultimo run
  python run_pipeline.py --schedule      Iniciar scheduler quincenal
        """,
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--full",
        action="store_true",
        help="Ejecutar el pipeline completo (fases 1-5)",
    )
    group.add_argument(
        "--phase",
        type=int,
        choices=[1, 2, 3, 4, 5],
        help="Ejecutar una fase especifica (1-5)",
    )
    group.add_argument(
        "--status",
        action="store_true",
        help="Mostrar el estado del ultimo run del pipeline",
    )
    group.add_argument(
        "--schedule",
        action="store_true",
        help="Iniciar el scheduler automatico (quincenal)",
    )

    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Ruta al archivo de configuracion (default: config/config.yaml)",
    )

    args = parser.parse_args()

    # Cargar variables de entorno
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass  # python-dotenv es opcional para --status

    if args.status:
        _show_status()
    elif args.schedule:
        _start_scheduler(args.config)
    elif args.full:
        _run_full(args.config)
    elif args.phase:
        _run_phase(args.phase, args.config)


def _run_full(config_path: str | None) -> None:
    """Ejecuta el pipeline completo."""
    from src.pipeline import ContentPipeline

    print("\n" + "=" * 60)
    print("  PIPELINE DE CONTENIDO - EJECUCION COMPLETA")
    print("=" * 60 + "\n")

    pipeline = ContentPipeline(config_path=config_path)
    state = pipeline.run_full()

    print(f"\nResultado: {state.status.value.upper()}")
    print(f"Run ID: {state.pipeline_run_id}")

    for phase_name, phase_state in state.phases.items():
        status_icon = {
            "completed": "OK",
            "failed": "FALLO",
            "pending": "pendiente",
            "running": "ejecutando",
        }.get(phase_state.status.value, "?")
        duration = f" ({phase_state.duration_seconds:.1f}s)" if phase_state.duration_seconds else ""
        print(f"  {phase_name}: {status_icon}{duration}")

    if state.status.value == "failed":
        sys.exit(1)


def _run_phase(phase_number: int, config_path: str | None) -> None:
    """Ejecuta una fase especifica."""
    from src.pipeline import ContentPipeline

    phase_names = {
        1: "Keyword Research",
        2: "Keyword Ranking",
        3: "Script Writing",
        4: "Design Briefs + Thumbnails",
        5: "Output + Google Drive Upload",
    }

    print(f"\n{'='*60}")
    print(f"  PHASE {phase_number}: {phase_names[phase_number]}")
    print(f"{'='*60}\n")

    pipeline = ContentPipeline(config_path=config_path)
    state = pipeline.run_phase(phase_number)

    phase_key = f"phase{phase_number}"
    phase_state = state.phases.get(phase_key)

    if phase_state:
        print(f"\nResultado: {phase_state.status.value.upper()}")
        if phase_state.duration_seconds:
            print(f"Duracion: {phase_state.duration_seconds:.1f}s")
        if phase_state.errors:
            print(f"Errores: {len(phase_state.errors)}")
            for err in phase_state.errors:
                print(f"  - {err}")

        if phase_state.status.value == "failed":
            sys.exit(1)


def _show_status() -> None:
    """Muestra el estado del ultimo run."""
    from src.pipeline import ContentPipeline

    pipeline = ContentPipeline()
    status = pipeline.get_status()

    print("\n" + "=" * 60)
    print("  ESTADO DEL PIPELINE")
    print("=" * 60 + "\n")

    if status.get("status") == "no_previous_run":
        print("No hay ejecuciones previas del pipeline.")
        return

    print(json.dumps(status, indent=2, ensure_ascii=False))


def _start_scheduler(config_path: str | None) -> None:
    """Inicia el scheduler automatico."""
    from src.scheduler import PipelineScheduler

    print("\n" + "=" * 60)
    print("  SCHEDULER AUTOMATICO - PIPELINE DE CONTENIDO")
    print("=" * 60 + "\n")

    scheduler = PipelineScheduler(config_path=config_path)
    scheduler.start()


if __name__ == "__main__":
    main()
