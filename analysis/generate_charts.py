# analysis/generate_charts.py
# Generates charts from the contamination loop log

import csv
import matplotlib
matplotlib.use("Agg")  # no display needed, just save files
import matplotlib.pyplot as plt
from collections import defaultdict

LOG_PATH = "../evidence/m3-contamination-log.csv"
OUT_DIR = "./charts"

# Read and aggregate by iteration
by_iteration = defaultdict(lambda: {"synthetic": [], "drift": []})

with open(LOG_PATH, newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        it = int(row["iteration"])
        by_iteration[it]["synthetic"].append(float(row["synthetic_fraction"]))
        by_iteration[it]["drift"].append(float(row["drift_score"]))

iterations = sorted(by_iteration.keys())
mean_synthetic = [sum(by_iteration[i]["synthetic"]) / len(by_iteration[i]["synthetic"]) for i in iterations]
mean_drift = [sum(by_iteration[i]["drift"]) / len(by_iteration[i]["drift"]) for i in iterations]

# Chart 1: Synthetic fraction vs iteration
plt.figure(figsize=(8, 5))
plt.plot(iterations, mean_synthetic, marker="o", color="crimson")
plt.title("Mean Synthetic Fraction of Retrieved Chunks vs Iteration")
plt.xlabel("Iteration")
plt.ylabel("Mean Synthetic Fraction")
plt.ylim(0, 1.05)
plt.grid(True, alpha=0.3)
plt.savefig(f"{OUT_DIR}/synthetic_fraction.png", dpi=150, bbox_inches="tight")
plt.close()

# Chart 2: Drift vs iteration
plt.figure(figsize=(8, 5))
plt.plot(iterations, mean_drift, marker="o", color="steelblue")
plt.title("Mean Answer Drift vs Iteration")
plt.xlabel("Iteration")
plt.ylabel("Mean Drift Score")
plt.ylim(0, 1.05)
plt.grid(True, alpha=0.3)
plt.savefig(f"{OUT_DIR}/answer_drift.png", dpi=150, bbox_inches="tight")
plt.close()

print(f"Charts saved to {OUT_DIR}/")
print(f"Mean synthetic fraction by iteration: {dict(zip(iterations, [round(x,3) for x in mean_synthetic]))}")
print(f"Mean drift by iteration: {dict(zip(iterations, [round(x,3) for x in mean_drift]))}")
