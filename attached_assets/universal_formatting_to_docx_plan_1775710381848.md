# Universal Formatting-to-DOCX Plan
## For `.md`, `.txt`, `.rtf`, `.html`, `.csv`, `.json`, `.xml`, `.yaml`, `.tex`, `.rst`, `.doc`, `.docx`, and `.pdf`

## Goal
Take an input file, extract or infer its structure, and generate a **clean, polished, editable `.docx`** with consistent typography, spacing, headings, tables, and layout.

The output should feel like a professionally formatted Word document, not a raw conversion dump.

---

# 1) Supported input types

## Best input types
These are the strongest sources for clean formatting output:

- `.docx`
- `.md`
- `.html`
- `.rtf`

These usually contain enough structure to preserve or remap cleanly.

## Good but less structured
These can work well, but require more inference:

- `.txt`
- pasted text
- copied AI output
- exported notes/emails

## Structured data inputs
These are text-based, but need custom interpretation rules:

- `.csv`
- `.json`
- `.xml`
- `.yaml`
- `.tex`
- `.rst`

These are not ordinary prose documents. They must be intentionally remapped into document sections, tables, or appendices.

## Legacy Word
- `.doc`

This should **always be converted to `.docx` first** before formatting.

## PDF
- `.pdf`

This can be used, but quality depends on PDF type:

- **Text PDF**: acceptable if real text is extractable
- **Scanned PDF**: weakest input; requires OCR and often reconstruction

---

# 2) Core principle

Do **not** treat every input the same.

The formatting workflow must first decide whether the file should be:

1. **preserved and cleaned**
2. **converted and normalized**
3. **reconstructed into a new document**
4. **interpreted as data and reformatted as a report**

That decision depends on the extension.

---

# 3) Input handling rules by extension

## `.docx`
### Handling mode
**Preserve + clean + restyle**

### What to do
- read existing structure
- inspect headings, tables, lists, sections, headers/footers
- detect direct formatting overrides
- normalize styles
- restyle the document without rewriting body text unless requested

### Use this when
The user wants:
- formatting repair
- better design
- bilingual headings
- font changes
- cleanup without losing Word editability

---

## `.doc`
### Handling mode
**Convert first, then clean**

### What to do
1. convert `.doc` to `.docx`
2. inspect what survived conversion
3. repair numbering, fonts, spacing, tables, headings
4. export a clean `.docx`

### Important rule
Never treat `.doc` as a native final-formatting source.  
Always pass through `.docx`.

---

## `.pdf`
### Handling mode
**Extract or reconstruct**

### If it is a text PDF
- extract real text
- detect headings, paragraphs, lists, and tables where possible
- rebuild as a new `.docx`

### If it is a scanned PDF
- OCR the text
- classify headings/paragraphs/tables manually or heuristically
- reconstruct as a new `.docx`
- expect lower fidelity

### Important rule
PDF is not a Word-native source.  
Formatting from PDF is usually a **rebuild**, not a true preservation workflow.

---

## `.md`
### Handling mode
**Parse structure + rebuild**

### What to do
- map `#`, `##`, `###` to heading levels
- convert bullets and numbered lists to real Word lists
- convert markdown tables to Word tables
- convert block structure into styled Word content

This is one of the best non-Word source formats.

---

## `.txt`
### Handling mode
**Infer structure + rebuild**

### What to do
- detect likely title
- detect section headings from casing, prefixes, spacing, numbering
- detect bullets and numbered lists
- merge broken paragraphs
- build a clean `.docx`

### Important rule
Plain text has weak structure.  
You must infer hierarchy before formatting.

---

## `.rtf`
### Handling mode
**Read + normalize**

### What to do
- extract styled text
- preserve headings/lists where possible
- remove inconsistent styling
- normalize font, spacing, and tables
- export polished `.docx`

---

## `.html`
### Handling mode
**Parse DOM + rebuild logically**

### What to do
- map `h1/h2/h3` to Word headings
- map `p` to body paragraphs
- map `ul/ol` to Word lists
- map `table` to Word tables
- ignore web-only styling that does not belong in Word
- generate a clean report-style `.docx`

### Important rule
Do not blindly mirror webpage styling.  
Extract document structure, not browser presentation.

---

## `.csv`
### Handling mode
**Interpret as table/report data**

### What to do
- read rows and columns
- determine whether the file is a single table or multiple logical sections
- create one or more clean Word tables
- optionally add a cover page and summary section
- apply readable table formatting

### Important rule
CSV is data, not prose.  
Do not force it into paragraph-style formatting.

---

## `.json`
### Handling mode
**Interpret hierarchical data**

### What to do
- detect nested objects and arrays
- convert them into:
  - document sections
  - definition lists
  - tables
  - appendices
- preserve key/value relationships clearly

### Best use cases
- configs
- exported records
- structured reports
- API output that needs presentation formatting

---

## `.xml`
### Handling mode
**Parse tree + remap to report structure**

### What to do
- parse the XML tree
- identify repeating nodes
- identify metadata blocks
- convert content into sections or tables
- preserve hierarchy where useful

### Important rule
XML should not be dumped raw unless requested.  
It should usually be transformed into a readable structure.

---

## `.yaml`
### Handling mode
**Interpret settings/configuration structure**

### What to do
- parse keys, nested objects, and arrays
- convert main sections into headings
- convert nested items into tables or indented sections
- make it readable as documentation

---

## `.tex`
### Handling mode
**Parse document semantics**

### What to do
- detect title, author, sections, subsections
- interpret lists, tables, and emphasized text
- ignore raw LaTeX command clutter unless needed
- rebuild in Word structure

### Important rule
Do not try to preserve LaTeX literally unless the goal is technical source display.

---

## `.rst`
### Handling mode
**Parse reStructuredText structure**

### What to do
- map heading markers to Word heading levels
- convert bullets, enumerations, and tables
- convert definition blocks into readable Word layout

---

# 4) Universal workflow

This is the standard pipeline regardless of input type.

## Step 1: Identify the file type
Determine whether the source is:
- Word-native
- text markup
- plain text
- structured data
- legacy format
- PDF

## Step 2: Choose processing mode
Use one of these modes:

- **Preserve and clean**
- **Convert then clean**
- **Rebuild from structure**
- **Reconstruct from extracted content**
- **Interpret data into report format**

## Step 3: Extract content
Extract:
- title
- metadata
- headings
- paragraphs
- lists
- tables
- appendices
- references
- headers/footers if relevant

## Step 4: Normalize structure
Create a clean internal structure like:

- title
- subtitle
- meta
- heading 1
- heading 2
- heading 3
- paragraph
- bullet list
- numbered list
- table
- note/callout
- appendix/reference item

## Step 5: Create a new or cleaned `.docx`
Depending on input type:
- clean an existing `.docx`
- or generate a new `.docx` from the normalized structure

## Step 6: Apply page layout
Set:
- page size
- margins
- paragraph spacing
- heading spacing
- line spacing
- alignment defaults

## Step 7: Apply style system
Define:
- title style
- subtitle style
- heading 1 / 2 / 3
- normal body
- table header
- table body
- caption/meta/note styles

## Step 8: Build the front matter
If appropriate, create:
- cover/title block
- metadata table
- executive summary box
- divider line or clean visual separator

## Step 9: Render document body
Insert content in order:
- headings
- paragraphs
- bullets
- numbered lists
- tables
- references
- appendix sections

## Step 10: Handle tables properly
Any source table must become a real Word table.

Rules:
- proper header row
- borders
- wrapped text
- readable column widths
- no raw markdown pipes
- no pasted plain-text tables unless explicitly requested

## Step 11: Apply bilingual headers if requested
If the user wants English + Arabic headers:
- translate title and headings only
- keep body unchanged unless asked otherwise
- place Arabic alongside English in a consistent style

## Step 12: Apply final font pass
Set the chosen font across:
- title
- headings
- body
- tables
- translated headers
- any directly formatted runs

This must be done explicitly because style defaults alone may not catch every run.

## Step 13: Save DOCX
Export the final editable Word file.

## Step 14: Render preview
Render the DOCX to PDF or images to check visual quality.

## Step 15: Inspect visually
Check for:
- broken fonts
- ugly page breaks
- cramped spacing
- broken Arabic shaping
- bad table wrapping
- inconsistent headings
- layout drift

## Step 16: Revise and re-export
Fix issues, save again, and re-render if needed.

## Step 17: Deliver final outputs
Provide:
- final `.docx`
- optional `.pdf` preview
- optional `.zip` fallback

---

# 5) Output strategy by input type

## For `.docx`
Prefer:
- preserve content
- repair formatting
- normalize styles
- improve design

## For `.doc`
Prefer:
- convert
- inspect damage
- repair
- export as `.docx`

## For `.pdf`
Prefer:
- extract text
- rebuild structure
- generate new `.docx`

## For `.md`, `.html`, `.rtf`, `.rst`, `.tex`
Prefer:
- parse structure
- rebuild as polished `.docx`

## For `.txt`
Prefer:
- infer structure
- rebuild as polished `.docx`

## For `.csv`, `.json`, `.xml`, `.yaml`
Prefer:
- interpret as data/document schema
- transform into readable report tables/sections
- generate `.docx`

---

# 6) Quality expectations by extension

## Highest quality expected
- `.docx`
- `.md`
- `.html`
- `.rtf`

## Good quality expected with some inference
- `.txt`
- `.rst`
- `.tex`

## Variable quality depending on source consistency
- `.csv`
- `.json`
- `.xml`
- `.yaml`

## Lower reliability
- `.doc`
- text PDF

## Lowest reliability
- scanned PDF

---

# 7) What must never happen

- Do not dump raw source formatting into Word without normalization
- Do not leave markdown tables as plain text
- Do not trust `.doc` as a clean native input
- Do not assume PDF preserves editable structure
- Do not apply one font change and assume the whole document updated
- Do not rely on blank lines instead of paragraph spacing
- Do not translate body text if the request is headers-only
- Do not skip preview rendering

---

# 8) Recommended implementation logic

## If source is `.docx`
Use a **repair-first** pipeline.

## If source is `.doc`
Use a **convert-first** pipeline.

## If source is `.pdf`
Use an **extract/reconstruct** pipeline.

## If source is `.md`, `.html`, `.rtf`, `.rst`, `.tex`
Use a **parse-and-rebuild** pipeline.

## If source is `.txt`
Use an **infer-and-rebuild** pipeline.

## If source is `.csv`, `.json`, `.xml`, `.yaml`
Use a **data-to-document transformation** pipeline.

---

# 9) Final rule

The pipeline should always answer this first:

**Am I preserving document structure, converting it, reconstructing it, or interpreting it?**

That is the real decision point.

Because bluntly:  
a `.docx` report, a `.csv` export, and a scanned `.pdf` are not the same job at all, even if they all end up as a `.docx`.
