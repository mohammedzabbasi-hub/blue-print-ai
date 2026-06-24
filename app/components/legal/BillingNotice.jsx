/* eslint-disable react/prop-types */
import { Link } from "react-router";

export default function BillingNotice({ className = "" }) {
  // TODO: Place this component on the paid plan or Shopify billing screen when that UI is added.
  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-amber-100 ${className}`}
    >
      BluePrintAI is currently free during its MVP/testing period. If paid
      Shopify billing is introduced in the future, review the{" "}
      <Link to="/refund-policy" className="text-cyan-100 underline">
        Refund Policy
      </Link>{" "}
      before purchasing.
    </div>
  );
}
