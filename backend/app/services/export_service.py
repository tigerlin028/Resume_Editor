"""
Resume export to DOCX and PDF.
PDF: ReportLab with Times-Roman. Two-column rows for company/date.
Technical Skills auto-fit to one line. Contact line centered with all fields.
"""
import re
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle,
)


# ── Shared helpers ────────────────────────────────────────────────────────────

def _strip_bold(text: str) -> str:
    return re.sub(r"\*\*([^*]+)\*\*", r"\1", text)


def _to_rl(text: str) -> str:
    """Convert **bold** markdown to ReportLab XML. Escapes &, <, >."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)


def _parse_lines(text: str):
    """
    Yield (kind, content) tuples.

    Kinds:
      name       # heading — candidate name
      contact    line immediately after name (phone | email | url)
      section    ## heading
      entry_org  **Company** | Location   (pipe-separated, has bold)
      entry_role Role | Date Range        (pipe-separated, no bold)
      skill      Category: items          (inside TECHNICAL SKILLS, no bullet)
      bullet     - text
      body       everything else
    """
    in_skills = False
    last_kind = None

    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            yield ('blank', '')
            last_kind = 'blank'
            continue

        if line.startswith('# '):
            in_skills = False
            last_kind = 'name'
            yield ('name', line[2:].strip())

        elif last_kind == 'name':
            # The line right after the name is always the contact line,
            # regardless of whether it contains | or not.
            last_kind = 'contact'
            yield ('contact', line)

        elif line.startswith('## '):
            section = line[3:].strip().upper()
            in_skills = 'SKILL' in section
            last_kind = 'section'
            yield ('section', section)

        elif line.startswith('- ') or line.startswith('* '):
            last_kind = 'bullet'
            yield ('bullet', line[2:])

        elif in_skills and ':' in line and not line.startswith('#'):
            last_kind = 'skill'
            yield ('skill', line)

        elif '|' in line:
            if re.search(r'\*\*', line):
                last_kind = 'entry_org'
                yield ('entry_org', line)
            else:
                last_kind = 'entry_role'
                yield ('entry_role', line)

        else:
            last_kind = 'body'
            yield ('body', line)


# ── DOCX export ───────────────────────────────────────────────────────────────

def _add_hor_rule(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '000000')
    pBdr.append(bottom)
    pPr.append(pBdr)


def _docx_two_col(doc, left_text, right_text, bold_left=False, italic_left=False):
    table = doc.add_table(rows=1, cols=2)
    table.style = 'Table Grid'
    for cell in table.rows[0].cells:
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        tcBorders = OxmlElement('w:tcBorders')
        for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
            border = OxmlElement(f'w:{side}')
            border.set(qn('w:val'), 'none')
            tcBorders.append(border)
        tcPr.append(tcBorders)

    left_cell, right_cell = table.rows[0].cells
    left_cell.width = Inches(4.8)
    right_cell.width = Inches(2.2)

    lp = left_cell.paragraphs[0]
    lp.paragraph_format.space_before = Pt(0)
    lp.paragraph_format.space_after = Pt(1)
    _docx_inline(lp, left_text, bold=bold_left, italic=italic_left)

    rp = right_cell.paragraphs[0]
    rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    rp.paragraph_format.space_before = Pt(0)
    rp.paragraph_format.space_after = Pt(1)
    _docx_inline(rp, right_text)


def _docx_inline(paragraph, text, bold=False, italic=False):
    for part in re.split(r"(\*\*[^*]+\*\*)", text):
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.name = "Times New Roman"
        else:
            run = paragraph.add_run(part)
            run.bold = bold
            run.italic = italic
            run.font.name = "Times New Roman"


def export_to_docx(optimized_text: str, output_path: str) -> None:
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Inches(0.55)
    sec.bottom_margin = Inches(0.55)
    sec.left_margin = Inches(0.75)
    sec.right_margin = Inches(0.75)

    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(10.5)

    for kind, content in _parse_lines(optimized_text):
        if kind == 'blank':
            p = doc.add_paragraph("")
            p.paragraph_format.space_after = Pt(1)

        elif kind == 'name':
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(content)
            run.bold = True
            run.font.name = "Times New Roman"
            run.font.size = Pt(18)

        elif kind == 'contact':
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(_strip_bold(content))
            run.font.name = "Times New Roman"
            run.font.size = Pt(10)

        elif kind == 'section':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(content)
            run.bold = True
            run.font.name = "Times New Roman"
            run.font.size = Pt(11)
            _add_hor_rule(doc)

        elif kind == 'entry_org':
            parts = [s.strip() for s in content.split('|')]
            _docx_two_col(doc, parts[0], parts[1] if len(parts) > 1 else '', bold_left=True)

        elif kind == 'entry_role':
            parts = [s.strip() for s in content.split('|')]
            _docx_two_col(doc, parts[0], parts[1] if len(parts) > 1 else '', italic_left=True)

        elif kind == 'skill':
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(1)
            _docx_inline(p, content)

        elif kind == 'bullet':
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(1)
            _docx_inline(p, content)

        else:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(1)
            _docx_inline(p, content)

    doc.save(output_path)


# ── PDF export (ReportLab) ────────────────────────────────────────────────────

_LM = 0.65 * inch
_RM = 0.65 * inch
_TM = 0.48 * inch
_BM = 0.48 * inch
_PW = letter[0]
_CW = _PW - _LM - _RM   # usable content width ≈ 519 pt


def _S():
    """Build style dict."""
    TR, TB, TI = 'Times-Roman', 'Times-Bold', 'Times-Italic'
    return {
        'name':       ParagraphStyle('name',    fontName=TB,  fontSize=17, leading=20, alignment=1, spaceAfter=1),
        'contact':    ParagraphStyle('contact', fontName=TR,  fontSize=9.5, leading=11, alignment=1, spaceAfter=2),
        'section':    ParagraphStyle('section', fontName=TB,  fontSize=10.5, leading=13, spaceBefore=5, spaceAfter=0),
        'entry_org':  ParagraphStyle('eorg',    fontName=TB,  fontSize=10,  leading=12, spaceBefore=3, spaceAfter=0),
        'entry_role': ParagraphStyle('erole',   fontName=TI,  fontSize=9.5, leading=11, spaceBefore=0, spaceAfter=1),
        'skill':      ParagraphStyle('skill',   fontName=TR,  fontSize=9.5, leading=11, spaceBefore=0, spaceAfter=1),
        'bullet':     ParagraphStyle('bullet',  fontName=TR,  fontSize=9.5, leading=11, leftIndent=12, firstLineIndent=-9, spaceBefore=0, spaceAfter=1),
        'body':       ParagraphStyle('body',    fontName=TR,  fontSize=9.5, leading=11, spaceBefore=0, spaceAfter=1),
        'right':      ParagraphStyle('right',   fontName=TR,  fontSize=9.5, leading=11, alignment=2),
        'right_i':    ParagraphStyle('righti',  fontName=TI,  fontSize=9.5, leading=11, alignment=2),
    }


def _two_col(left_para, right_para, lw_frac=0.70):
    lw = _CW * lw_frac
    rw = _CW * (1 - lw_frac)
    t = Table([[left_para, right_para]], colWidths=[lw, rw])
    t.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    return t


def _fit_para(text: str, font: str, start_size: float, width: float, leading_add=2,
               space_before=0, space_after=1) -> Paragraph:
    """Return a Paragraph fitting `text` in `width` in one line, shrinking font as needed."""
    for size in (start_size, start_size - 0.5, start_size - 1, start_size - 1.5, start_size - 2):
        if size < 7:
            break
        style = ParagraphStyle(f'fit_{font}_{size}',
                               fontName=font, fontSize=size,
                               leading=size + leading_add,
                               spaceBefore=space_before, spaceAfter=space_after)
        p = Paragraph(text, style)
        _, h = p.wrap(width, 9999)
        if h <= size + leading_add + 1:   # fits in one line
            return p
    # fallback: return at smallest tried size
    style = ParagraphStyle(f'fit_{font}_fallback',
                           fontName=font, fontSize=size,
                           leading=size + leading_add,
                           spaceBefore=space_before, spaceAfter=space_after)
    return Paragraph(text, style)


def export_to_pdf(optimized_text: str, output_path: str) -> None:
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        topMargin=_TM, bottomMargin=_BM,
        leftMargin=_LM, rightMargin=_RM,
    )
    S = _S()
    story = []

    for kind, content in _parse_lines(optimized_text):
        if kind == 'blank':
            story.append(Spacer(1, 2))

        elif kind == 'name':
            story.append(Paragraph(content, S['name']))

        elif kind == 'contact':
            clean = _strip_bold(content)
            story.append(Paragraph(_to_rl(clean), S['contact']))

        elif kind == 'section':
            story.append(Paragraph(content, S['section']))
            story.append(HRFlowable(width='100%', thickness=0.75,
                                    color=colors.black, spaceAfter=2))

        elif kind == 'entry_org':
            parts = [s.strip() for s in content.split('|')]
            left_txt = _to_rl(parts[0])
            right_txt = _to_rl(parts[1]) if len(parts) > 1 else ''
            lw = _CW * 0.70
            lp = _fit_para(left_txt, 'Times-Bold', 10, lw, space_before=3, space_after=0)
            rp = Paragraph(right_txt, S['right'])
            story.append(_two_col(lp, rp, 0.70))

        elif kind == 'entry_role':
            parts = [s.strip() for s in content.split('|')]
            left_txt = _to_rl(parts[0])
            right_txt = _to_rl(parts[1]) if len(parts) > 1 else ''
            lw = _CW * 0.72
            # Auto-shrink the role/degree text to fit on one line
            lp = _fit_para(left_txt, 'Times-Italic', 9.5, lw, space_before=0, space_after=1)
            rp = Paragraph(right_txt, S['right_i'])
            story.append(_two_col(lp, rp, 0.72))

        elif kind == 'skill':
            # Auto-shrink to fit one line
            story.append(_fit_para(_to_rl(content), 'Times-Roman', 9.5, _CW,
                                   space_before=0, space_after=1))

        elif kind == 'bullet':
            story.append(Paragraph(f"• {_to_rl(content)}", S['bullet']))

        else:
            story.append(Paragraph(_to_rl(content), S['body']))

    doc.build(story)
