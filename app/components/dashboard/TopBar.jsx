const ranges = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export default function TopBar({ dateRange, onDateRangeChange, showDateFilter = false }) {
  return (
    <header className="h-[60px] flex-shrink-0 bg-[#0d1526]/80 backdrop-blur-sm border-b border-white/5 px-6 flex items-center gap-4 rounded-xl">
      <div className="mr-2">
        <h1 className="text-[15px] font-semibold text-white leading-tight">
          Command Center
        </h1>
        <p className="text-[11px] text-slate-500">Saved app overview</p>
      </div>

      <div className="flex-1" />

      {showDateFilter && (
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {ranges.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onDateRangeChange?.(value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 ${
                dateRange === value
                  ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
