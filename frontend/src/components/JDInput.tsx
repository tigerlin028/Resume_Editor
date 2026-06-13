'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export default function JDInput({ value, onChange, disabled }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        目标职位描述（JD）
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="请将目标岗位的职位描述粘贴到这里...&#10;&#10;例如：&#10;【职位名称】后端开发工程师&#10;【职位要求】&#10;- 3年以上后端开发经验&#10;- 熟悉 Python / Go / Java&#10;..."
        rows={10}
        className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-y
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-400"
      />
      {value && (
        <p className="mt-1 text-xs text-gray-400 text-right">{value.length} 字符</p>
      )}
    </div>
  );
}
