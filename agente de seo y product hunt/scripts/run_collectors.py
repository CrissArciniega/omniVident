"""
Parallel Collector Launcher
Ejecuta MercadoLibre y Amazon collectors simultaneamente para maxima velocidad.

Uso:
    python scripts/run_collectors.py
"""

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

PROGRESS_FILE = Path(__file__).parent.parent / "outputs" / "agent_progress.json"
ROOT_DIR = Path(__file__).parent.parent


def report_progress(percent: int, message: str, detail: str = ""):
    try:
        PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
        PROGRESS_FILE.write_text(json.dumps({
            "percent": percent,
            "message": message,
            "detail": detail,
            "timestamp": int(time.time() * 1000),
            "active": True,
        }, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def run_collector(name: str, script: str) -> tuple[str, int, float]:
    """Run a collector script and return (name, exit_code, duration)."""
    start = time.time()
    print(f"\n{'='*50}")
    print(f"[PARALLEL] Iniciando {name}...")
    print(f"{'='*50}")

    try:
        result = subprocess.run(
            [sys.executable, script],
            cwd=str(ROOT_DIR),
            timeout=300,  # 5 min max per collector
        )
        duration = time.time() - start
        print(f"\n[PARALLEL] {name} completado (code: {result.returncode}) en {duration:.1f}s")
        return (name, result.returncode, duration)
    except subprocess.TimeoutExpired:
        duration = time.time() - start
        print(f"\n[PARALLEL] {name} TIMEOUT despues de {duration:.1f}s")
        return (name, -1, duration)
    except Exception as e:
        duration = time.time() - start
        print(f"\n[PARALLEL] {name} ERROR: {e}")
        return (name, -1, duration)


def main():
    print("=" * 60)
    print("PARALLEL COLLECTOR LAUNCHER")
    print("MercadoLibre + Amazon simultaneamente")
    print("=" * 60)

    report_progress(2, "Iniciando recopilacion paralela...", "MercadoLibre + Amazon simultaneamente")

    collectors = [
        ("MercadoLibre", "agents/mercadolibre_collector.py"),
        ("Amazon", "agents/amazon_collector.py"),
    ]

    start_total = time.time()
    results = {}

    with ThreadPoolExecutor(max_workers=len(collectors)) as executor:
        futures = {
            executor.submit(run_collector, name, script): name
            for name, script in collectors
        }

        for future in as_completed(futures):
            name = futures[future]
            try:
                cname, code, duration = future.result()
                results[cname] = {"code": code, "duration": duration}
                done = len(results)
                pct = 5 + int((done / len(collectors)) * 80)
                status = "OK" if code == 0 else "FALLO"
                report_progress(
                    pct,
                    f"{cname} completado ({done}/{len(collectors)})",
                    f"{status} en {duration:.0f}s"
                )
            except Exception as e:
                results[name] = {"code": -1, "duration": 0}
                print(f"[PARALLEL] {name}: Thread error - {e}")

    total_time = time.time() - start_total

    # Summary
    print("\n" + "=" * 60)
    print("RESUMEN COLLECTORS PARALELOS:")
    all_ok = True
    for name, info in results.items():
        emoji = "OK" if info["code"] == 0 else "FALLO"
        print(f"  {name}: [{emoji}] {info['duration']:.1f}s")
        if info["code"] != 0:
            all_ok = False
    print(f"\n  Tiempo total (paralelo): {total_time:.1f}s")
    print("=" * 60)

    report_progress(85, "Recopilacion completada", f"Ambos collectors en {total_time:.0f}s")

    # Return 0 if at least one succeeded (partial data is better than none)
    any_ok = any(info["code"] == 0 for info in results.values())
    return 0 if any_ok else 1


if __name__ == "__main__":
    sys.exit(main())
