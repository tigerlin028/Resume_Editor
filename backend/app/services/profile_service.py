"""
Candidate profile: accumulate and merge resume versions via Claude.
"""
import asyncio
import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models import Profile

INSTRUCTION_SYNC_PROMPT = """Decide whether this resume adjustment instruction contains new personal information worth saving to a candidate profile.

Personal information worth saving: new courses taken, new skills learned, certifications earned, new job/project experience, updated metrics or dates, contact info changes.
NOT worth saving: formatting requests, style changes, tone adjustments, requests to emphasize or reorder existing content, length changes.

If the instruction DOES contain new personal information:
- Extract only the new facts as a short structured snippet using this format:
  Courses: <course1>, <course2>          ← only if new courses mentioned
  Skills: <skill1>, <skill2>             ← only if new skills mentioned
  Note: <free-form fact>                 ← for anything else (experience, cert, etc.)
- Output only that snippet, nothing else.

If the instruction does NOT contain new personal information, output exactly:
NO_UPDATE"""


MERGE_PROMPT = """You maintain a structured candidate profile. Given an existing profile and a new resume, output the complete updated profile.

OUTPUT FORMAT (follow exactly):
# CANDIDATE PROFILE: [Full Name]
Contact: [phone] | [email] | [url]

## EDUCATION

### [University Name] | [City, State]
Degree: [degree, major, GPA: X.XX] | [timeline]
Courses: [comma-separated relevant courses, omit if none]

## EXPERIENCE

### [Company Name] | [City, State] | [Start] – [End]

#### [Version — label]
Role: [job title]
- [achievement bullet with metrics]
Tools: [tool1, tool2, ...]

## SKILLS POOL
[Category]: skill1, skill2, ...

## MANUAL ADDITIONS
[preserve unchanged]

MERGE RULES:
1. If the existing profile is empty: convert the new resume directly into the profile format. Use a single version per company with no version header.
2. Match companies by name (case-insensitive, fuzzy). When the same company is found:
   - If the new content is >50% different (different title, tools, or bullets): add as a new Version with a descriptive label.
   - If the new content is nearly identical: keep the better-written version only.
3. Version labels should describe the focus: e.g. "SDE / Data-Engineering", "Analytics / Business", "ML / Research".
4. If a company has only one version, do NOT add a version header — write bullets directly.
5. Education: merge course lists (deduplicate), use the latest GPA/timeline if updated.
6. Skills Pool: union of all skills from all versions, deduplicated, grouped by category.
7. Manual Additions section: always preserve exactly as-is.
8. Preserve all metrics and specific numbers.

Output ONLY the complete profile. No explanation."""


def _sync_merge(existing: str, new_resume: str) -> str:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    user_msg = f"EXISTING PROFILE:\n{existing or '(empty)'}\n\nNEW RESUME:\n{new_resume}"
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=MERGE_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    return msg.content[0].text.strip()


async def get_or_create_profile(db: AsyncSession) -> Profile:
    result = await db.execute(select(Profile).limit(1))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = Profile(structured_text="", owner_name=None)
        db.add(profile)
        await db.flush()
    return profile


async def merge_resume_into_profile(db: AsyncSession, resume_text: str) -> Profile:
    profile = await get_or_create_profile(db)
    merged = await asyncio.to_thread(_sync_merge, profile.structured_text, resume_text)
    profile.structured_text = merged
    # Extract name from first line: "# CANDIDATE PROFILE: Name"
    first_line = merged.split('\n')[0]
    if 'PROFILE:' in first_line:
        profile.owner_name = first_line.split('PROFILE:', 1)[-1].strip()
    await db.commit()
    await db.refresh(profile)
    return profile


async def sync_instruction_to_profile(db: AsyncSession, instruction: str) -> bool:
    """
    Silently check if an adjustment instruction contains new personal info.
    If so, merge it into the profile. Returns True if profile was updated.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Step 1: Haiku detects + extracts personal info from instruction
    detection = await asyncio.to_thread(
        lambda: client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=INSTRUCTION_SYNC_PROMPT,
            messages=[{"role": "user", "content": instruction}],
        ).content[0].text.strip()
    )

    if detection == "NO_UPDATE" or not detection:
        return False

    # Step 2: Merge the extracted snippet into the profile
    profile = await get_or_create_profile(db)

    if not profile.structured_text.strip():
        # No profile yet — just save to MANUAL ADDITIONS, not enough info for full profile
        profile.structured_text = f"## MANUAL ADDITIONS\n{detection.strip()}\n"
    else:
        def _merge_snippet(existing: str, snippet: str) -> str:
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            user_msg = (
                f"EXISTING PROFILE:\n{existing}\n\n"
                f"NEW FACTS TO ADD (a short snippet, not a full resume — "
                f"integrate these facts into the appropriate sections):\n{snippet}"
            )
            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=MERGE_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
            return msg.content[0].text.strip()

        merged = await asyncio.to_thread(_merge_snippet, profile.structured_text, detection)
        profile.structured_text = merged
        first_line = merged.split('\n')[0]
        if 'PROFILE:' in first_line:
            profile.owner_name = first_line.split('PROFILE:', 1)[-1].strip()

    await db.commit()
    return True


async def append_manual_text(db: AsyncSession, text: str) -> Profile:
    profile = await get_or_create_profile(db)
    if "## MANUAL ADDITIONS" in profile.structured_text:
        profile.structured_text = profile.structured_text.rstrip() + f"\n{text.strip()}\n"
    else:
        profile.structured_text = profile.structured_text.rstrip() + f"\n\n## MANUAL ADDITIONS\n{text.strip()}\n"
    await db.commit()
    await db.refresh(profile)
    return profile
