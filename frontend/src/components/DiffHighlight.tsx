'use client';
import type { DiffOp } from '@/types';

interface Props {
  diffOps: DiffOp[];
}

export default function DiffHighlight({ diffOps }: Props) {
  const renderLines = (text: string, cls: string) =>
    text.split('\n').map((line, i) => (
      <div key={i} className={`${cls} px-1 rounded leading-relaxed`}>
        {line || <span>&nbsp;</span>}
      </div>
    ));

  return (
    <div className="font-mono text-sm whitespace-pre-wrap">
      {diffOps.map((op, i) => {
        if (op.op === 'equal') {
          return (
            <div key={i}>
              {op.new.split('\n').map((line, j) => (
                <div key={j} className="leading-relaxed px-1">{line || <span>&nbsp;</span>}</div>
              ))}
            </div>
          );
        }
        if (op.op === 'insert') {
          return <div key={i}>{renderLines(op.new, 'bg-green-100 text-green-900')}</div>;
        }
        if (op.op === 'delete') {
          return <div key={i}>{renderLines(op.old, 'bg-red-100 text-red-700 line-through')}</div>;
        }
        if (op.op === 'replace') {
          return (
            <div key={i}>
              {renderLines(op.old, 'bg-red-100 text-red-700 line-through')}
              {renderLines(op.new, 'bg-green-100 text-green-900')}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
