# Resume Editor — AI Resume Optimizer

A local web app: upload your resume or load your saved profile + paste a job description → Claude API optimizes → PDF preview with inline editing → export PDF/Word.

---

## Quick Start

```bash
# Backend (port 8000)
cd backend
uvicorn main:app --reload --port 8000

# Frontend (port 3000, separate terminal)
cd frontend
npm run dev
```

Open `http://localhost:3000`.  
Create `backend/.env` with: `ANTHROPIC_API_KEY=sk-ant-...`

**Data persistence**: all history, optimization results, and profile data are stored in `backend/resume_editor.db` (SQLite) and `backend/uploads/`. Closing the processes does not lose any data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · FastAPI · SQLAlchemy (async) · aiosqlite · SQLite |
| AI | Anthropic Claude API (`claude-sonnet-4-6` main · `claude-haiku-4-5` quick tasks) · Prompt Caching · SSE streaming |
| Resume parsing | pdfplumber (word-level y-grouping) · python-docx |
| Export | reportlab (PDF, Times New Roman) · python-docx (DOCX) |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS |

---

## Project Structure

```
Resume_Editor/
├── backend/
│   ├── main.py                     # FastAPI entry, CORS, startup table creation
│   ├── requirements.txt
│   ├── .env                        # ANTHROPIC_API_KEY (not committed)
│   ├── resume_editor.db            # Auto-created at runtime, persistent
│   └── app/
│       ├── config.py
│       ├── database.py
│       ├── models.py               # ORM: sessions / resumes / optimizations / exports / profile
│       ├── schemas.py
│       ├── api/routes/
│       │   ├── resume.py           # POST /resumes/upload (auto-merges into profile after upload)
│       │   ├── optimize.py         # POST /optimize  +  GET /optimize/stream/{sid}
│       │   ├── history.py          # GET/DELETE /history, PATCH /{id}/title
│       │   ├── export.py           # POST /export/{id}/pdf|docx, POST /export/custom/{fmt}, GET /export/download/{id}
│       │   └── profile.py          # GET/PUT /profile, POST /profile/add-text, POST /profile/start-session
│       └── services/
│           ├── resume_parser.py    # pdfplumber + python-docx → plain text
│           ├── claude_service.py   # Prompt caching + streaming + profile input support
│           ├── diff_service.py     # Content-based line diff (normalizes formatting markers)
│           ├── export_service.py   # reportlab PDF + python-docx DOCX
│           └── profile_service.py  # Claude-assisted resume merge into profile
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx            # Main page: upload/profile → JD → optimize → preview
        │   ├── history/page.tsx    # History page (supports full state restore, inline rename)
        │   └── profile/page.tsx    # Profile management page
        ├── components/
        │   ├── ResumeUploader.tsx
        │   ├── JDInput.tsx
        │   ├── InstructionBox.tsx
        │   ├── ComparisonView.tsx  # PDF preview / inline edit / diff toggle
        │   ├── ResumePreview.tsx   # PDF layout replica (Times New Roman, two-column)
        │   ├── DiffHighlight.tsx
        │   ├── ExportButtons.tsx   # Exports AI result or manually edited version
        │   └── HistoryList.tsx     # Inline title rename
        ├── hooks/
        │   ├── useOptimize.ts      # SSE streaming + loadResult (history restore)
        │   └── useHistory.ts
        └── lib/api.ts              # All backend API calls
```

---

## API Endpoints (prefix `/api/v1`)

| Method | Path | Description |
|---|---|---|
| POST | /resumes/upload | Upload PDF/DOCX, parse, async merge into profile |
| POST | /optimize | Start optimization |
| GET | /optimize/stream/{session_id} | SSE token stream |
| GET | /optimize/{id} | Get full result |
| GET | /history | Paginated history list |
| GET | /history/{session_id} | Session detail with all versions |
| PATCH | /history/{session_id}/title | Rename session |
| DELETE | /history/{session_id} | Delete session |
| POST | /export/{id}/pdf | Generate PDF from saved optimization |
| POST | /export/{id}/docx | Generate DOCX from saved optimization |
| POST | /export/custom/{fmt} | Generate PDF or DOCX from arbitrary text (inline edits) |
| GET | /export/download/{id} | Download saved export file |
| GET | /profile | Get current profile |
| PUT | /profile | Replace profile content |
| POST | /profile/add-text | Append text to MANUAL ADDITIONS |
| POST | /profile/start-session | Create session from profile (no file upload needed) |

---

## Key Design Notes

### Inline Editing in PDF Preview

After optimization completes, an **Edit** button appears in the PDF preview toolbar. Clicking it replaces the preview with a raw-Markdown textarea where you can fix small errors without consuming tokens. Clicking **Done Editing** re-renders the corrected preview and shows a **Manually Edited** badge. The export buttons then call `POST /export/custom/{fmt}` to generate the file directly from the edited text — no database record is created, and the temp file is deleted after the response is sent.

---

### Candidate Profile System

**Purpose**: Accumulate all resume versions across sessions so Claude always picks the most relevant experience for the current JD.

**Format** (structured Markdown):
```
# CANDIDATE PROFILE: First Last
Contact: phone | email | url

## EDUCATION
### University Name | City, State
Degree: ..., GPA: X.XX | timeline
Courses: ...

## EXPERIENCE
### Company | City, State | Start – End

#### [Version — SDE / Data-Engineering]
Role: Job Title
- Achievement bullets...
Tools: Python, SQL, Spark

#### [Version — Analytics / Business]
Role: Job Title
- Different angle bullets...
Tools: Tableau, Excel

## SKILLS POOL
Category: skill1, skill2, ...

## MANUAL ADDITIONS
[Free-text additions typed directly by user]
```

**Merge flow**: on every resume upload, Claude merges the new resume into the existing profile as a background task (non-blocking). Same company with >50% different content → new Version; otherwise keep the better-written one. Skills Pool is the union of all versions. MANUAL ADDITIONS are always preserved as-is.

**Instruction sync**: when the user types supplementary instructions before optimizing, Haiku silently scans for new personal facts (courses, skills, experience). If found, they are merged into the profile in the background — so the profile stays current without extra effort.

**Profile-based generation**: "Use Saved Profile" on the main page calls `/profile/start-session`, which creates a session backed by the profile text. The rest of the optimization flow is identical to a normal upload. In this mode, the diff tab is hidden (comparing against a multi-version profile is not meaningful).

---

### Claude Optimization Strategy

The system prompt uses a silent two-step framework:

1. **Internal analysis (never output)**: silently identify top-3 required technical skills, top-3 responsibility themes, and 4–6 repeated JD keywords.
2. **Remap the resume**:
   - Reorder experiences within a section to put the most JD-relevant role first (chronology can be broken)
   - Rewrite bullets using the JD's exact vocabulary, not just shorten them
   - Bold 1–3 JD-critical keywords per bullet using `**...**`
   - Internship titles are flexible — rewrite to match the JD's framing if the actual work supports it
   - Reorganize Technical Skills so JD-relevant skills appear first (max 4 categories, 5–7 items each)
   - For profile input: read all Versions per company, pick or blend the most JD-relevant one; write the company header exactly once even if multiple roles/versions exist

**Prompt caching breakpoints**: system prompt (every call) + resume/profile text (cache hit when same content is reused across multiple optimizations).

---

### PDF Export (reportlab)

Key logic in `export_service.py`:

- **Uniform font size**: all body content (bullets, skill lines, courses, body text) uses 9.5pt Times-Roman — no per-line shrinking. Section titles use 10.5pt bold; company names 10pt bold; role lines 9.5pt italic.
- **One-page auto-fit**: `export_to_pdf` tries spacing scales `1.0 → 0.95 → 0.90 → 0.86 → 0.82`. Each scale tightens `spaceBefore`/`spaceAfter`/`leading` uniformly — font sizes never change. Page count is measured via `_PageCounter` (a `SimpleDocTemplate` subclass that counts pages in `afterPage()`).
- **Bullet alignment**: bullet indent is computed from the actual rendered width of `"• "` in Times-Roman 9.5pt using `stringWidth()`, so the bullet symbol and continuation lines align perfectly regardless of platform.
- `_parse_lines(text)`: generator yielding `(kind, content)` tuples. When `last_kind == 'name'`, the very next non-blank line is always `contact` regardless of whether it contains `|`.
- `_fit_para(text, font, size, width)`: shrinks font in 0.5pt steps until text fits one line — used only for long company/degree/role header lines.
- `_two_col(left, right, frac)`: reportlab `Table` for company/date two-column rows, zero padding.
- Margins: 0.65 inch left/right, 0.48 inch top/bottom, usable width ≈ 519 pt.
- No horizontal rule after the contact line; HR only under section headers.

---

### Browser PDF Preview (ResumePreview)

`ResumePreview.tsx` replicates the PDF layout with inline CSS:
- `font-family: "Times New Roman", Times, serif`
- TypeScript parser mirroring `_parse_lines` exactly
- Two-column rows via `flex justify-between` (bold company left, date right)
- Italic role line, `•` bullet with left indent matching PDF metrics
- Displayed on a gray background as a centered paper card (`max-width: 680px`, box shadow)
- Renders the live-edited text when in inline edit mode

---

### Content-Based Diff

`diff_service.py` normalizes lines before comparison — strips `##`/`#`, `- `/`●`/`•` bullet markers, `**bold**`, and `|` — then runs `SequenceMatcher` on the cleaned text but stores original lines in the output. Result: lines that differ only in formatting markers (e.g. `●` vs `-`) are shown as equal; only genuine content changes are highlighted red/green.

---

## Pages

| Route | Description |
|---|---|
| `/` | Main: upload or load profile → paste JD → optimize → PDF preview with inline edit → export |
| `/history` | All past sessions; click "Reload" to fully restore comparison view; hover title to rename |
| `/profile` | View and edit the structured profile; append free-text experience |
