"""Headless simulation runner (`make sim`) for physics validation by eye.

Runs the heat-wave + load-spike scenario at accelerated sim-time and prints a
telemetry table. Every column traces to the C57.91 model in transformer.py.
"""

from __future__ import annotations

from sim.scenario import Simulation

TRIGGER_AT_HOURS = 1.0
TOTAL_SIM_HOURS = 8.0
DT_HOURS = 0.02
PRINT_EVERY_HOURS = 0.5


def main() -> None:
    sim = Simulation()
    triggered = False
    next_print = 0.0
    elapsed = 0.0

    header = f"{'t(h)':>6} {'load(MVA)':>10} {'K':>6} {'Tamb':>6} {'Toil':>7} {'Ths':>7} {'F_AA':>7} {'LoL(h)':>8}  status"
    print(header)
    print("-" * len(header))

    steps = int(TOTAL_SIM_HOURS / DT_HOURS)
    for _ in range(steps):
        if not triggered and elapsed >= TRIGGER_AT_HOURS:
            sim.trigger_scenario()
            triggered = True
        snap = sim.tick(DT_HOURS)
        elapsed = snap.sim_time_hours
        if elapsed >= next_print:
            t = snap.transformer
            print(
                f"{elapsed:6.2f} {t.node_load_mva:10.1f} {t.loading_k:6.2f} "
                f"{snap.ambient.air_temp_c:6.1f} {t.top_oil_c:7.1f} {t.hot_spot_c:7.1f} "
                f"{t.aging_factor_faa:7.2f} {t.cumulative_loss_of_life_hours:8.1f}  {t.status}"
            )
            next_print += PRINT_EVERY_HOURS


if __name__ == "__main__":
    main()
