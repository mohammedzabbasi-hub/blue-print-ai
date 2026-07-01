/* eslint-disable react/prop-types */
export default function AIDisclaimer({ className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm font-semibold leading-6 text-cyan-50/90 ${className}`}
    >
      AI-generated results may be inaccurate. Review before relying on,
      publishing, or making business decisions.
    </div>
  );
}
