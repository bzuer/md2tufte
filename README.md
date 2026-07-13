# md2tufte

Static site built with Astro and Tufte CSS. The author keeps writing Markdown in `content/` and the site renders it with the same sidenote and footnote syntax.
Example content can be found at cruz.rio.br/md2tufte.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL printed by Astro to preview changes with hot reload.

## Scripts

```bash
npm run dev      # development server
npm run build    # generates minified CSS + static build to dist/
npm run preview  # serve the built site (local preview)
```

Optional wrapper:

```bash
./scripts/manage.sh dev
./scripts/manage.sh deploy  # build + nginx (default)
```

Server setup (Nginx, port 1213 by default):

```bash
./scripts/setup-nginx.sh --port 1213
```

If you access the site via a custom host (e.g. Cloudflared), pass it as
`server_name`:

```bash
./scripts/setup-nginx.sh --port 1213 --server-name cruz.rio.br
```

For Cloudflared, point the tunnel to `http://127.0.0.1:1213`.

## Project Structure

```
content/              Markdown source (kept unchanged)
content/img/          Image assets served from /static/img/
public/static/        Tufte CSS assets and fonts
src/layouts/          Astro layouts
src/lib/              Markdown pipeline and Tufte helpers
src/pages/            Astro routes (`index.astro` -> `content/index.md`, `[slug]/index.astro` -> other `content/*.md`)
```

## Markdown Support

- Sidenotes: `Main text^[This becomes a sidenote]`
- Footnotes: `Main text[^note]` + `[^note]: note text` (rendered as sidenotes)
- Margin notes from image titles: `![Alt](path "Caption")`
- Margin notes via `{:.marginnote}` on inline emphasis or links
- Math: inline `$E = mc^2$` or block `$$ a^2 + b^2 = c^2 $$` (rendered with KaTeX)
- Multi-page: any `content/*.md` (except `index.md`) is emitted at `/{filename}` via `src/pages/[slug]/index.astro`

## Notes

- The site reads `content/index.md` directly to keep the author workflow intact.
- Assets are served from `/static/` to preserve existing links.
- Build assets emitted to `/static/_astro` inside `dist`.
- `npm run build` regenerates `public/static/css/styles.min.css` from `public/static/css/styles.dev.css` and embeds a content hash in the production CSS URL for cache busting.
- Images should live in `content/img/` and be referenced as `/static/img/...` in Markdown.

## Example Content

# **The *md2tufte* Possibilities**: a Brief and Practical Guide 

This document is a comprehensive, self-contained demonstration of Markdown syntax and advanced styling techniques, showcasing how to create clear, effective, and visually sophisticated technical writing. Written entirely in Markdown with embedded HTML where necessary, it serves as both a reference and a live example. 

The guide emphasizes readability, logical structure, and thoughtful integration of text, code, images, and tables. It draws inspiration from Edward Tufte's principles of information design—prioritizing clarity, precision, efficiency, high data-ink ratio, and respect for the reader's intelligence—while adapting them to modern web-based Markdown rendering.

<label for="fig-1" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="fig-1" class="margin-toggle"/>
<span class="marginnote">
<img src="/static/img/tufte.png" alt="Detailed description"/>
</span>

Edward Tufte, professor emeritus at Yale University, revolutionized data visualization and communication through works such as *The Visual Display of Quantitative Information* (1983), *Envisioning Information* (1990), and *Visual Explanations* (1997). His philosophy advocates graphical excellence, elimination of "chartjunk," seamless integration of evidence, and multifunctional elements that serve multiple purposes simultaneously. 

Here, we apply these ideas to Markdown documents by maintaining a focused main column for primary content, placing supplementary material in margins or full-width sections, and ensuring every visual or structural element contributes meaningfully to understanding.

Key Tufte concepts appear throughout this guide: high data-ink ratio, careful layering of information, tight coupling of words and visuals, and a preference for small multiples over single, overloaded graphics. 

Each category below includes not just syntax, but the reason the layout supports cognition.


## Document Structure: Headings

**Tuftean Rationale: Macro/Micro Readings**

Headings provide a macro-structure that allows readers to understand the document's scope at a glance while navigating to specific micro-details. 

This hierarchical layering prevents "flatland" (the lack of depth in information presentation) and establishes a clear path for cognitive processing.

In Tufte's terms, headings should function like a map legend: concise, stable, and informative. Keep the hierarchy shallow so the reader can scan without losing the narrative thread. Headings are not decoration; they are a high-level index to the evidence that follows.

**Markdown Syntax**

```md
# Heading Level 1 (H1)
## Heading Level 2 (H2)
### Heading Level 3 (H3)
#### Heading Level 4 (H4)

```

**Rendered Example**

# Heading Level 1 (H1)

## Heading Level 2 (H2)

### Heading Level 3 (H3)

#### Heading Level 4 (H4)

Limit depth to H1–H4 to avoid excessive nesting, which introduces unnecessary visual complexity.


## Text Formatting: Paragraphs, Breaks, and Emphasis

**Tuftean Rationale: Minimalist Elegance and Signal-to-Noise Ratio**

Tufte advocates for using the minimum amount of formatting necessary to convey meaning. Paragraph breaks provide structural "white space," which functions as a silent separator. 

Bold and italic tools must be used strictly for "signal" enhancement; over-formatting creates visual noise that competes with the data.

Treat the paragraph as the primary unit of reasoning. Each paragraph should make one claim or advance one step, with emphasis used to clarify, not to decorate. If everything is emphasized, nothing is.

**Markdown Syntax**

```md
This paragraph contains *italic*, **bold**, and ***bold italic*** text.

Another paragraph follows.

Line with hard break.  
Next line after two spaces.

```

**Rendered Example**

This paragraph contains *italic*, **bold**, and ***bold italic*** text.

Another paragraph follows.

Line with hard break.  
Next line after two spaces.

Use emphasis purposefully: bold for strong claims, italics for terms or nuance. Overuse diminishes impact and creates visual noise.


## Lists: Unordered, Ordered, and Nested

**Tuftean Rationale: Parallelism and Comparison**

Lists facilitate the comparison of discrete items within a single visual field. By organizing data into parallel structures, the reader can more easily identify patterns and relationships between variables, which is a core tenet of Tufte's analytical design.

Use lists when the reader benefits from scanning and comparing items side by side. Avoid long, decorative lists; in Tufte's view, each item should earn its place by adding evidence or a distinct concept.

**Markdown Syntax**

```md
- Unordered item
- Another item
  - Nested level
    - Deeper level (use sparingly)

1. Ordered step
2. Next step
   1. Sub-step
   2. Another sub-step

```

**Rendered Example**

* Unordered item
* Another item
  - Nested level
    - Deeper level (use sparingly)

1. Ordered step
2. Next step
   1. Sub-step
   2. Another sub-step

Keep nesting shallow to preserve clarity and maintain high informational density.


## Links and Images

**Tuftean Rationale: Integration of Visual Evidence**

Evidence should be placed exactly where it is needed. 

Tufte argues that text and graphics should be "seamlessly integrated" so the eye does not have to jump across pages to find the relevant illustration. 

Links serve as "micro-pathways" to deeper evidence without cluttering the primary narrative.

Images should carry information, not mood. A link is an invitation to verify or extend the claim. When you can, connect the claim directly to its evidence in the same visual neighborhood.

**Links**

**Markdown Syntax**

```md
[Display text](https://example.com)

```

**Example**

[PPGAS](https://ppgas.mn.ufrj.br)

**Images**

**Markdown Syntax**

```md
![Alt text](/static/img/imga.png)

```

Images should provide substantive visual evidence, not decoration. Always include meaningful alt text for accessibility.

Place images adjacent to the paragraph that references them, so the reader can compare claim and evidence without scrolling.

**Rendered Example**

![Alt text](/static/img/imga.png)


## Blockquotes

**Tuftean Rationale: Layering and Separation**

Blockquotes provide a visual cue that information is being "borrowed" or emphasized from another source. This creates a secondary layer of information within the primary text, allowing for the inclusion of external authority without breaking the internal logic of the document.

Use blockquotes sparingly and keep them short. Tufte prefers that quotations sit close to the argument they support, with minimal typographic drama so the evidence, not the ornament, stands out.

**Markdown Syntax**

```md
> Primary quote line.
> Continues across lines.
>
> - Can contain lists
> - Or other elements

```

**Rendered Example**

> Primary quote line.
> Continues across lines.
> * Can contain lists
> * Or other elements
> 
> 

Pair blockquotes with a nearby comment or margin note that explains why the quoted material matters.


## Code: Inline and Blocks

**Tuftean Rationale: Precision and Technical Literacy**

For technical documentation, code is the "raw data." Tufte emphasizes the importance of showing exact data to allow the reader to verify conclusions. 

Differentiating between inline commands and functional blocks maintains technical precision while preserving the flow of prose.

Treat code as evidence. Keep it readable, use language tags to support syntax highlighting, and prefer small, relevant snippets over long dumps unless the full context is essential to the claim.

**Inline Code**

Use backticks for technical terms or short commands.

**Syntax**

```md
`inline code`

```

**Example**
`npm run dev`

**Fenced Code Blocks**

Preserve formatting and enable syntax highlighting.

**Syntax**

```md
```js
const message = "Hello, Markdown!";
console.log(message);

```

```

**Rendered Example**
```js
const message = "Hello, Markdown!";
console.log(message);

```

Specify language after the opening fences for highlighting.

Highlighting is not decoration; it helps the reader parse structure quickly.


## Tables

**Tuftean Rationale: High Data Density**

Tables are often superior to graphics for small datasets. They allow for the presentation of precise numbers and categorical data in a compact format. 

Tufte suggests that tables should be "rich in information but thin in ink," avoiding heavy borders that distract from the data itself.

Use tables when exact values matter. A clean table lets the reader compare without decoding an image. Keep the structure simple and align numbers and labels so patterns can be seen quickly.

**Markdown Syntax**

```md
| Feature      | Purpose             | Notes                       |
|--------------|---------------------|-----------------------------|
| Headings     | Hierarchy           | Consistent levels           |
| Lists        | Organization        | Limit nesting depth         |
| Code Blocks  | Technical examples  | Use language identifiers    |

```

**Rendered Example**

| Feature      | Purpose              | Notes                        |
| --- | --- | --- |
| Headings      | Hierarchy            | Consistent levels            |
| Lists        | Organization        | Limit nesting depth          |
| Code Blocks  | Technical examples  | Use language identifiers    |

Align columns logically and keep entries brief.

If a table needs interpretation, add a caption or a short sentence directly below it to guide the reader.


## Task Lists

**Tuftean Rationale: Functional Elements**

Task lists serve as multifunctional elements—they provide both information (what needs to be done) and a mechanism for status tracking (what has been done). 

This dual-purpose design increases the utility of the document.

Use them to make progress visible without adding narrative clutter. The check mark is a compact signal with a high information value, consistent with Tufte's preference for efficiency.

**Markdown Syntax**

```md
- [x] Completed task
- [ ] Pending task

```

**Rendered Example**

* [x] Completed task
* [ ] Pending task

Use task lists for process documentation, not for narrative sections.


## sidenotes

**Tuftean Rationale: Parallel Information Streams**

Sidenotes (and footnotes) allow for "side-streaming" of information. This enables the author to include necessary definitions, citations, or asides without interrupting the reader's primary focus on the main narrative.

Keep sidenotes brief and relevant. They are most effective when they clarify, cite, or add a small but useful detail. Long digressions belong in the main text or a separate section.

**Markdown Syntax**

```md
Text with sidenote.[^1]

[^1]: The sidenotes content appears in margin.

```

**Example**

Text with sidenote.[^1]

In this project, footnote syntax renders in the margin, so the reader never needs to jump to the bottom of the page. This keeps references close to the claim, which is a key Tufte principle.


## Advanced Layout Patterns (Tufte-Inspired)

**Tuftean Rationale: Multi-Window Viewing and High Resolution**

These advanced patterns utilize the full available space of the digital canvas. Margin notes and image quilts allow the reader to view multiple pieces of information simultaneously, facilitating deep analytical comparisons that a standard single-column layout cannot support.

Use these patterns only when they improve comprehension. Tufte warns against empty decoration; each additional layout device should increase the clarity and density of information, not add noise.


### Margin Notes

Place non-essential but helpful content (definitions, citations, asides) in the margin.

They are best for short, factual additions that enrich the main paragraph without forcing the reader to detour.


**Inline Syntax**

```md
*Margin note text*{:.marginnote}
[Link as margin note](https://example.com){:.marginnote}

```


### Image Grids (Quilts)

Display related images for comparison or progression.

This is the digital equivalent of Tufte's small multiples: many small views of the same subject make patterns visible.


**Rendered example**

<div class="image-quilt fullwidth">
  <img src="/static/img/img-1.png" alt="Description 1" />
  <img src="/static/img/img-2.png" alt="Description 2" />
  <img src="/static/img/img-3.png" alt="Description 3" />
  <img src="/static/img/img-4.png" alt="Description 4" />
</div>


**HTML Syntax**

```html
<div class="image-quilt fullwidth">
  <img src="/static/img/img-1.png" alt="Description 1" />
  <img src="/static/img/img-2.png" alt="Description 2" />
  <img src="/static/img/img-3.png" alt="Description 3" />
  <img src="/static/img/img-4.png" alt="Description 4" />
</div>

```

### Margin Figures with Toggle

Responsive margin images with toggle on small screens.

<label for="fig-1" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="fig-1" class="margin-toggle"/>
<span class="marginnote">
<img src="/static/img/imga.png" alt="Detailed description"/>
</span>

This keeps the margin behavior in a narrow viewport while still honoring Tufte's preference for side-by-side evidence.

**HTML Syntax**

```html
<label for="fig-1" class="margin-toggle">&#8853;</label>
<input type="checkbox" id="fig-1" class="margin-toggle"/>
<span class="marginnote">
  <img src="/static/img/imga.png" alt="Detailed description"/>
</span>

```

### Full-Width Code Blocks

Preserve long lines or horizontal alignment.

Use full width when formatting or alignment is part of the meaning, such as columns or long commands.

**HTML Syntax**

```html
<pre class="fullwidth"><code>
# Long code that benefits from extra width
import matplotlib.pyplot as plt
# ... extended code
</code></pre>

```

**Rendered example**

<pre class="fullwidth"><code>
import matplotlib.pyplot as plt
import numpy as np
import random
from itertools import combinations

def build_the_image(n_points, n_lines, points_color='#e6aa62', line_color='#5e8b6a', file_name="output.png"):

    coords = np.random.rand(n_points, 2)

    fig, ax = plt.subplots(figsize=(5, 5))

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

build_the_image(n_points=20, n_lines=10, file_name="img-N.png")

</code></pre>

### Full-Width Tables

Accommodate wide datasets or many columns.

Full-width tables should remain light on rules and heavy on useful numbers.

**HTML Syntax**

```html
<table class="fullwidth">
  <thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
  <tbody></tbody>
</table>

```

**Rendered example**

<table class="fullwidth">
  <thead>
    <tr>
      <th>Rank</th>
      <th>Country</th>
      <th>Projected Population (2025)</th>
      <th>World Population %</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>India</td>
      <td>1.45 billion</td>
      <td>17.5%</td>
      <td>Most populous; surpassed China in 2023</td>
    </tr>
    <tr>
      <td>2</td>
      <td>China</td>
      <td>1.41 billion</td>
      <td>17.1%</td>
      <td>Population peaking and beginning slow decline</td>
    </tr>
    <tr>
      <td>3</td>
      <td>United States</td>
      <td>347 million</td>
      <td>4.2%</td>
      <td>Third place; growth driven by migration</td>
    </tr>
    <tr>
      <td>4</td>
      <td>Indonesia</td>
      <td>286 million</td>
      <td>3.5%</td>
      <td>Largest Muslim-majority country by population</td>
    </tr>
    <tr>
      <td>5</td>
      <td>Pakistan</td>
      <td>251 million</td>
      <td>3.0%</td>
      <td>Rapid growth; high fertility rate</td>
    </tr>
    <tr>
      <td>6</td>
      <td>Nigeria</td>
      <td>232 million</td>
      <td>2.8%</td>
      <td>Fastest-growing in top 10; Africa leader</td>
    </tr>
    <tr>
      <td>7</td>
      <td>Brazil</td>
      <td>211 million</td>
      <td>2.6%</td>
      <td>Largest in South America</td>
    </tr>
    <tr>
      <td>8</td>
      <td>Bangladesh</td>
      <td>176 million</td>
      <td>2.1%</td>
      <td>Highest population density among large countries</td>
    </tr>
    <tr>
      <td>9</td>
      <td>Russia</td>
      <td>146 million</td>
      <td>1.8%</td>
      <td>Largest by land area; declining population</td>
    </tr>
    <tr>
      <td>10</td>
      <td>Mexico</td>
      <td>134 million</td>
      <td>1.6%</td>
      <td>Growth slowing; urbanization high</td>
    </tr>
  </tbody>
  <par></par>
  <caption><strong>Table 1:</strong> <italic>Top 10 Most Populous Countries in 2025 (Medium Variant Projections)</italic></caption>
</table>

### Full-Width Figures

Allow large visuals to breathe.

Use these sparingly so that wide elements remain a clear signal of importance.

**HTML Syntax**

```html
<figure class="fullwidth">
  <img src="/static/img/wide.png" alt="Description"/>
    <par>...</par>
  <figcaption>Caption explaining the figure.</figcaption>
</figure>


```

<figure class="fullwidth">
  <img src="/static/img/img-full.png" alt="Nothing"/>
</figure>

### Newthought (Small Caps Lead-In)

Subtle typographic emphasis for paragraph openings.

It is a gentle cue that a new idea has begun, without the weight of a new heading.

**HTML Syntax**

```html
<span class="newthought">Opening phrase</span> continues the paragraph.

```


## Horizontal Rules

**Tuftean Rationale: Visual Separation**

Horizontal rules act as clear, low-ink boundaries between distinct conceptual sections, signaling a transition without the need for verbose transitional text.

They are most useful between major shifts in topic, not between minor paragraphs.

**Markdown Syntax**

```md

```


## Escaping Characters

**Tuftean Rationale: Technical Integrity**

The ability to escape characters ensures that the tool (Markdown) does not interfere with the data (syntax). This prevents ambiguity, ensuring the reader sees exactly what the author intended.

When precision matters, show the literal characters so the reader can reproduce the result without guesswork.

**Markdown Syntax**

```md
\*escaped asterisks\* and \`backticks\`

```

**Rendered**

*escaped asterisks* and `backticks`


## Inline HTML (Use Judiciously)

**Tuftean Rationale: Extending the Toolkit**

Standard Markdown is occasionally insufficient for high-resolution information display. Judicious use of HTML allows the author to introduce sophisticated elements like "details/summary" tags, which provide information "on demand," maintaining a clean primary interface.

Use HTML only when it improves clarity or structure. If HTML becomes the default, you lose the simplicity that makes Markdown readable.

**Example: Expandable Section**

```html
<details>
  <summary>Click to expand</summary>
  <p>Additional content appears here.</p>
</details>

```


## Common Document Patterns

**Tuftean Rationale: Structural Appropriateness**
Matching the document pattern to the goal ensures that the layout supports the specific cognitive task—whether that is following a linear narrative (Essay) or performing a quick lookup (Reference Guide).
Choose the smallest structure that gets the job done. A good structure reduces searching and makes evidence easy to find.

* **Essay**: Title → Introduction → Sectioned body → Conclusion → References (use margins for citations).
* **Reference Guide**: Title → Headings-based TOC → Short topical sections → Code/table examples.
* **Tutorial**: Goal → Prerequisites → Numbered steps → Verification → Troubleshooting.


## Writing Guidelines for Clarity

**Tuftean Rationale: Principles of Analytical Design**

Clarity is achieved by eliminating the "middleman" of complex prose. Active voice and direct lists reduce the cognitive distance between the reader and the information.

Aim for high data density with low visual noise. Every line should carry meaning, and every element should earn its space.

* Keep paragraphs concise for scannability.
* Favor active voice.
* Use lists and tables for structured data.
* Provide exact code in fenced blocks.
* Support claims with links or sidenotes.
* Ensure every element—text, code, image, or table—serves the reader's understanding.


## Starter Template

**Tuftean Rationale: Simplification of Workflow**

A standardized template ensures that the principles of hierarchy and layering are applied consistently across all documents, allowing the author to focus on the data rather than the formatting.

Consistency is a form of respect for the reader: it creates predictable places for evidence, notes, and examples.

```md
# Document Title

Brief introductory paragraph stating purpose.

## First Section

Core explanation with supporting examples.

## Second Section

- Key point one
- Key point two

## References

[^1]: Source or additional note.

```

This template incorporates headings, lists, and sidenotes while remaining extensible with Tufte-style classes for margins and full-width elements as needed.

[^1]: The sidenotes content appears in margin.
