# analysis/generate_gradient_chart.py
# Shows synthetic fraction by tier (B1/B2/B3) over iterations — the semantic-distance gradient.

import csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from collections import defaultdict

def load_by_tier(path):
    by_tier_iter = defaultdict(lambda: defaultdict(list))
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tier = row["tier"]
            it = int(row["iteration"])
            by_tier_iter[tier][it].append(float(row["synthetic_fraction"]))
    return by_tier_iter

# Unfiltered gradient (all three tiers)
data = load_by_tier("./evidence/v2/gradient-log.csv")

plt.figure(figsize=(9, 5.5))
colors = {"B1": "crimson", "B2": "darkorange", "B3": "seagreen"}
labels = {"B1": "B1: Paraphrases of Set A", "B2": "B2: Adjacent facets, same docs", "B3": "B3: Unrelated topics"}

for tier in ["B1", "B2", "B3"]:
    iters = sorted(data[tier].keys())
    means = [sum(data[tier][i]) / len(data[tier][i]) for i in iters]
    plt.plot(iters, means, marker="o", color=colors[tier], label=labels[tier])

plt.title("Contamination Spread by Semantic Distance from Poisoned Queries")
plt.xlabel("Iteration")
plt.ylabel("Mean Synthetic Fraction of Retrieved Chunks")
plt.ylim(-0.05, 1.05)
plt.legend()
plt.grid(True, alpha=0.3)
plt.savefig("./analysis/charts/v2/gradient_by_tier.png", dpi=150, bbox_inches="tight")
plt.close()

print("Saved gradient_by_tier.png")
for tier in ["B1", "B2", "B3"]:
    iters = sorted(data[tier].keys())
    means = [round(sum(data[tier][i]) / len(data[tier][i]), 3) for i in iters]
    print(f"{tier}: {dict(zip(iters, means))}")
