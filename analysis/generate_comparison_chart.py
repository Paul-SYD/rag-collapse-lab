# analysis/generate_comparison_chart.py
# Overlay chart: contaminated (unfiltered) vs controlled (filtered) synthetic fraction

import csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from collections import defaultdict

def load_mean_synthetic(path):
    by_iter = defaultdict(list)
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            by_iter[int(row["iteration"])].append(float(row["synthetic_fraction"]))
    iterations = sorted(by_iter.keys())
    means = [sum(by_iter[i]) / len(by_iter[i]) for i in iterations]
    return iterations, means

contaminated_iters, contaminated_means = load_mean_synthetic("../evidence/m3-contamination-log.csv")
controlled_iters, controlled_means = load_mean_synthetic("../evidence/m5-comparison-log.csv")

plt.figure(figsize=(9, 5.5))
plt.plot(contaminated_iters, contaminated_means, marker="o", color="crimson", label="No control (contaminated)")
plt.plot(controlled_iters, controlled_means, marker="o", color="seagreen", label="Provenance filter ON (controlled)")
plt.title("RAG Collapse: With vs Without Provenance Control")
plt.xlabel("Iteration")
plt.ylabel("Mean Synthetic Fraction of Retrieved Chunks")
plt.ylim(-0.05, 1.05)
plt.legend()
plt.grid(True, alpha=0.3)
plt.savefig("./charts/comparison_overlay.png", dpi=150, bbox_inches="tight")
plt.close()

print("Saved comparison_overlay.png")
print(f"Contaminated: {dict(zip(contaminated_iters, [round(x,3) for x in contaminated_means]))}")
print(f"Controlled:   {dict(zip(controlled_iters, [round(x,3) for x in controlled_means]))}")
