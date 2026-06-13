'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  isAdjustment?: boolean;
}

export default function InstructionBox({ value, onChange, disabled, isAdjustment }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {isAdjustment ? '调整指令' : '补充说明（可选）'}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={
          isAdjustment
            ? '告诉我需要如何调整...&#10;例如：把我在字节做过的推荐系统项目加进去，这个项目使用了协同过滤算法，提升了CTR 15%'
            : '可以补充简历上没有的经历，或给出特殊要求...&#10;例如：我还有一段在 XX 公司的实习经历（3个月），主要做数据分析，请适当加入'
        }
        rows={4}
        className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-y
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}
