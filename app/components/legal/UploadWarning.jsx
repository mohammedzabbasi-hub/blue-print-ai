/* eslint-disable react/prop-types */
export default function UploadWarning({ className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-amber-100 ${className}`}
    >
      Do not upload sensitive personal information, confidential files, or
      content you do not have rights to use.
    </div>
  );
}
