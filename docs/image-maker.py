import matplotlib.pyplot as plt
import numpy as np
import random
from itertools import combinations

def build_the_image(n_points, n_lines, points_color='#e6aa62', line_color='#5e8b6a', file_name="output.png"):

    coords = np.random.rand(n_points, 2)

    fig, ax = plt.subplots(figsize=(10, 20))

    fig.patch.set_facecolor('none')
    fig.patch.set_alpha(0)
    ax.set_facecolor('none')

    todas_possibilidades = list(combinations(range(n_points), 2))
    n_lines = min(n_lines, len(todas_possibilidades))
    conexoes = random.sample(todas_possibilidades, n_lines)

    for i, j in conexoes:
        p1, p2 = coords[i], coords[j]
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=line_color, linewidth=0.5, alpha=0.6)

    ax.scatter(coords[:, 0], coords[:, 1], color=points_color, s=20, zorder=3)

    ax.set_axis_off()
    plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
    plt.margins(0, 0)

    plt.savefig(file_name, dpi=300, transparent=True, bbox_inches='tight', pad_inches=0)
    plt.close(fig)

build_the_image(n_points=30, n_lines=200, file_name="img-side.png")
