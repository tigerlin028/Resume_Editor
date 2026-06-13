import re
import difflib
import json


def _normalize(line: str) -> str:
    """Strip formatting markers so diff compares content, not symbols."""
    line = line.strip()
    line = re.sub(r'^#{1,3}\s+', '', line)               # ## headings
    line = re.sub(r'^[-*●•○◆▪✓]\s*', '', line)          # bullet chars
    line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)       # **bold**
    line = re.sub(r'\|', ' ', line)                       # pipe separators
    return line.lower().strip()


def compute_diff(original: str, optimized: str) -> str:
    """
    Content-based line diff: compare normalized lines for alignment,
    but store original line text in the output so the display is readable.
    """
    original_lines = original.splitlines()
    optimized_lines = optimized.splitlines()

    orig_norm = [_normalize(l) for l in original_lines]
    opt_norm = [_normalize(l) for l in optimized_lines]

    matcher = difflib.SequenceMatcher(None, orig_norm, opt_norm, autojunk=False)
    ops = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        old_text = "\n".join(original_lines[i1:i2])
        new_text = "\n".join(optimized_lines[j1:j2])
        # Treat as equal if both sides have identical normalized content
        if tag == 'replace' and _normalize(old_text) == _normalize(new_text):
            tag = 'equal'
        ops.append({"op": tag, "old": old_text, "new": new_text})
    return json.dumps(ops, ensure_ascii=False)
