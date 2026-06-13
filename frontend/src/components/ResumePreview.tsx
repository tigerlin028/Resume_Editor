'use client';
import { ReactNode, CSSProperties } from 'react';

// ── Inline bold renderer ──────────────────────────────────────────────────────
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

// ── Line parser (mirrors Python _parse_lines) ─────────────────────────────────
type Kind = 'name' | 'contact' | 'section' | 'entry_org' | 'entry_role' | 'skill' | 'bullet' | 'body' | 'blank';

function parseLines(text: string): { kind: Kind; content: string }[] {
  const out: { kind: Kind; content: string }[] = [];
  let lastKind: Kind | null = null;
  let inSkills = false;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!line) {
      out.push({ kind: 'blank', content: '' });
      lastKind = 'blank';
      continue;
    }
    if (line.startsWith('# ')) {
      inSkills = false; lastKind = 'name';
      out.push({ kind: 'name', content: line.slice(2).trim() });
    } else if (lastKind === 'name') {
      lastKind = 'contact';
      out.push({ kind: 'contact', content: line });
    } else if (line.startsWith('## ')) {
      const sec = line.slice(3).trim().toUpperCase();
      inSkills = sec.includes('SKILL'); lastKind = 'section';
      out.push({ kind: 'section', content: sec });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      lastKind = 'bullet';
      out.push({ kind: 'bullet', content: line.slice(2) });
    } else if (inSkills && line.includes(':') && !line.startsWith('#')) {
      lastKind = 'skill';
      out.push({ kind: 'skill', content: line });
    } else if (line.includes('|')) {
      if (/\*\*/.test(line)) {
        lastKind = 'entry_org'; out.push({ kind: 'entry_org', content: line });
      } else {
        lastKind = 'entry_role'; out.push({ kind: 'entry_role', content: line });
      }
    } else {
      lastKind = 'body';
      out.push({ kind: 'body', content: line });
    }
  }
  return out;
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const FONT = '"Times New Roman", Times, serif';
const S = {
  name:      { textAlign: 'center', fontWeight: 'bold', fontSize: '17px', lineHeight: '20px', marginBottom: '1px' } as CSSProperties,
  contact:   { textAlign: 'center', fontSize: '9.5px', lineHeight: '12px', marginBottom: '2px' } as CSSProperties,
  hr:        { border: 'none', borderTop: '0.75px solid #000', margin: '1px 0' } as CSSProperties,
  sectionHr: { border: 'none', borderTop: '0.75px solid #000', margin: '1px 0 2px' } as CSSProperties,
  section:   { fontWeight: 'bold', fontSize: '10.5px', lineHeight: '13px', marginTop: '5px' } as CSSProperties,
  orgRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '10px', lineHeight: '13px', marginTop: '3px' } as CSSProperties,
  orgLeft:   { fontWeight: 'bold' } as CSSProperties,
  orgRight:  { fontWeight: 'normal', fontSize: '9.5px' } as CSSProperties,
  roleRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '9.5px', lineHeight: '11px', fontStyle: 'italic', marginBottom: '1px' } as CSSProperties,
  skill:     { fontSize: '9.5px', lineHeight: '12px', marginBottom: '1px' } as CSSProperties,
  bullet:    { display: 'flex', gap: '5px', fontSize: '9.5px', lineHeight: '12px', marginBottom: '1px', paddingLeft: '6px' } as CSSProperties,
  body:      { fontSize: '9.5px', lineHeight: '12px', marginBottom: '1px' } as CSSProperties,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ResumePreview({ text }: { text: string }) {
  const lines = parseLines(text);
  const els: ReactNode[] = [];

  lines.forEach(({ kind, content }, i) => {
    const key = i;
    switch (kind) {
      case 'blank':
        els.push(<div key={key} style={{ height: '3px' }} />);
        break;
      case 'name':
        els.push(<div key={key} style={S.name}>{content}</div>);
        break;
      case 'contact':
        els.push(<div key={key} style={S.contact}>{content}</div>);
        break;
      case 'section':
        els.push(
          <div key={key}>
            <div style={S.section}>{content}</div>
            <hr style={S.sectionHr} />
          </div>
        );
        break;
      case 'entry_org': {
        const [left, right = ''] = content.split('|').map(s => s.trim());
        els.push(
          <div key={key} style={S.orgRow}>
            <span style={S.orgLeft}><Inline text={left} /></span>
            <span style={S.orgRight}>{right}</span>
          </div>
        );
        break;
      }
      case 'entry_role': {
        const [left, right = ''] = content.split('|').map(s => s.trim());
        els.push(
          <div key={key} style={S.roleRow}>
            <span>{left}</span>
            <span>{right}</span>
          </div>
        );
        break;
      }
      case 'skill':
        els.push(<div key={key} style={S.skill}><Inline text={content} /></div>);
        break;
      case 'bullet':
        els.push(
          <div key={key} style={S.bullet}>
            <span style={{ flexShrink: 0, marginTop: '1px' }}>•</span>
            <span><Inline text={content} /></span>
          </div>
        );
        break;
      default:
        els.push(<div key={key} style={S.body}><Inline text={content} /></div>);
    }
  });

  return (
    <div style={{ fontFamily: FONT, background: 'white', padding: '38px 44px', width: '100%', boxSizing: 'border-box' }}>
      {els}
    </div>
  );
}
