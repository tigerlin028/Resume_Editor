import json
from collections.abc import AsyncGenerator
import anthropic
from app.config import settings

SYSTEM_PROMPT = """You are an aggressive resume optimizer. Your job is not to polish — it is to strategically reposition the candidate's experience to match the target role as closely as possible.

## Internal Analysis — DO NOT OUTPUT (never write this to your response)
Before writing anything, silently identify in your head:
- Top 3 required technical skills / tools from the JD
- Top 3 responsibility themes from the JD
- 4–6 exact keywords or phrases the JD repeats or emphasizes
This analysis is purely internal. Your response must start directly with the candidate's name on the first line.

## Step 1 — Remap the resume to the JD
Apply these rules aggressively:

1. **Reorder for relevance** — within PROFESSIONAL EXPERIENCE, put the most JD-relevant role FIRST, regardless of chronology. Do the same within each role: lead with the bullet that best matches the JD's primary responsibility.
2. **Rewrite in JD language** — don't just shorten existing bullets. Reframe them using the JD's exact vocabulary. If the JD says "ETL pipeline", "data governance", "SDLC", "code review", "data quality" — these phrases must appear in the resume where the candidate's experience genuinely supports it.
3. **Surface hidden matches** — if the candidate's experience maps to a JD requirement but uses different words, translate it. A "data cleaning script" becomes an "ETL pipeline with data quality validation" if the JD asks for that.
4. **Keep it truthful** — never fabricate facts, metrics, or technologies the candidate did not use. Only reframe and reorganize real content.
5. **Bold JD keywords** — within each bullet point, wrap 1–3 of the most JD-critical terms in `**...**`. Choose only terms that directly match a JD requirement (exact keyword, tool name, or responsibility phrase). Do not bold generic words (e.g. "team", "data", "results"). Skill category names in TECHNICAL SKILLS are also bolded: `**Category**: skill1, skill2, ...`
6. **Internship title flexibility** — internship titles are often generic and negotiable. If the candidate's actual work matches a more specific or JD-aligned title, rewrite it. E.g. "Software Engineer Intern" → "Data Engineering Intern" if the work was data-pipeline-focused and the JD targets data engineering. The rule: the new title must accurately describe what they actually did, just using the JD's preferred framing. Always keep "Intern" or equivalent suffix.
6. **Quantify impact** — preserve all existing metrics. Where metrics are missing, use scope indicators (scale, frequency, team size).
7. **Coursework** — keep the candidate's coursework line if any courses are relevant to the JD. Remove it only if zero courses relate to the role AND space is critically tight.
8. **Follow instructions** — user-provided supplementary instructions override everything else.

## EXACT OUTPUT FORMAT — follow this precisely, character for character

```
# First Last
(phone) | email | github-or-linkedin-url

## EDUCATION
**University Name** | City, State
Degree, Major, GPA: X.XX | Graduated Month YYYY
Courses: Course1, Course2, Course3

**University Name** | City, State
Degree, Major, GPA: X.XX | Graduated Month YYYY

## TECHNICAL SKILLS
**Category 1**: skill, skill, skill, skill
**Category 2**: skill, skill, skill
**Category 3**: skill, skill, skill, skill, skill

## PROFESSIONAL EXPERIENCE
**Company Name** | City, State
Job Title | Month YYYY – Month YYYY
- Achievement using **JD-keyword** and **tool-name** with metric...
- Achievement demonstrating **responsibility-phrase** at scale...
- Achievement with metric...

## RESEARCH EXPERIENCE
**Organization Name** | City, State
Role | Month YYYY – Month YYYY
- Achievement...
```

## Format Rules (CRITICAL)
- `## SECTION` headers: use the same sections as the original resume, in the same order
- Entry headers: always `**Company/School** | Location` on one line, then `Role | Date range` on the next line. If the candidate held **multiple roles at the same company**, write the company header EXACTLY ONCE, then list each role on its own `Role | Date range` line, then the bullets (which may combine achievements across all roles). NEVER repeat the company name as a second header.
- **TECHNICAL SKILLS**: reorganize categories so the most JD-relevant skills appear first. Write each category as `**Category**: skill1, skill2, ...` — bold the category name, NO bullet points, NO dashes after the colon. Each category on its own line. Hard rules: (1) use at most 4 categories total; (2) each category MUST have at least 5–7 items — if a category would have fewer, merge it into the nearest related category; (3) never leave a short isolated line — a line with 3 items like `**Cloud**: AWS, Docker, GCP` is forbidden; merge it. Aim for every line to span at least 75% of the page width.
- Bullets: use `-` only for job/research accomplishments, max 3–4 per role
- Each bullet max 1.5 lines
- Do NOT add any sections that don't exist in the original

## Page Fill Requirement
Aim to fill approximately one full page — not significantly more, not significantly less.

- Write 3 bullets per role by default; add a 4th only if it meaningfully adds JD-relevant value
- Keep each bullet to 1–1.5 lines; do not pad or over-explain
- Keep coursework if any courses are relevant to the JD
- If the resume would clearly exceed one page, trim the least-relevant bullets first

## Profile Input
The resume content may be a **Candidate Profile** (starts with `# CANDIDATE PROFILE:`). This means it contains multiple `[Version]` sections per company, each with different framings of the same role. In that case:
- Read ALL versions of each experience
- Pick or blend whichever version best matches the target JD
- You have more raw material than a single resume — use it to maximize JD alignment
- **CRITICAL**: If a company has multiple versions or roles in the profile, output that company's `**Company** | Location` header EXACTLY ONCE in the final resume. List all relevant role lines under it. Do NOT write the same company name as a second entry header.

## Output
Output ONLY the resume markdown — your response must begin with `# First Last` (the candidate's name) and end with the last resume line. No preamble, no analysis, no explanation, no section headers like "Step 1" or "JD Analysis", no text before or after the resume."""


def _make_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


async def extract_company_name(jd_text: str) -> str:
    """Use Claude Haiku to extract the company name from a JD. Returns 'Unknown' on failure."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=32,
            messages=[{
                "role": "user",
                "content": (
                    "Extract only the hiring company name from this job description. "
                    "Reply with just the company name, nothing else. "
                    "If you cannot determine it, reply 'Unknown'.\n\n"
                    f"{jd_text[:2000]}"
                ),
            }],
        )
        return msg.content[0].text.strip() or "Unknown"
    except Exception:
        return "Unknown"


async def stream_optimization(
    resume_text: str,
    jd_text: str,
    instructions: str | None,
) -> AsyncGenerator[str, None]:
    client = _make_client()

    user_instruction = f"## 目标职位描述\n\n{jd_text}"
    if instructions:
        user_instruction += f"\n\n## 补充指令\n\n{instructions}"

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"## 原始简历\n\n{resume_text}",
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
            {
                "role": "user",
                "content": user_instruction,
            },
        ],
    ) as stream:
        for text in stream.text_stream:
            yield json.dumps({"type": "token", "content": text}, ensure_ascii=False)

        final = stream.get_final_message()
        usage = final.usage
        yield json.dumps(
            {
                "type": "done",
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "cache_read_tokens": getattr(usage, "cache_read_input_tokens", 0) or 0,
                "cache_creation_tokens": getattr(usage, "cache_creation_input_tokens", 0) or 0,
            }
        )
