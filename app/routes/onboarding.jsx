import { useState } from "react";
import { useNavigate } from "react-router";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const niches = [
  "Beauty & Skincare",
  "Health & Wellness",
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Food & Beverage",
  "Pet Products",
  "Fitness",
];

const goals = [
  "Increase sales",
  "Improve creative performance",
  "Find better creator styles",
];

export const meta = () => {
  return [{ title: "Onboarding | BluePrintAI" }];
};

function saveSession(data) {
  if (typeof window === "undefined") return;

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("access_token", data.token);
    localStorage.setItem("authToken", data.token);
  }

  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }

  if (data.shop) {
    localStorage.setItem("selectedShopId", String(data.shop.id));
    localStorage.setItem("shop_id", String(data.shop.id));
    localStorage.setItem("selectedShop", JSON.stringify(data.shop));
  }

  localStorage.setItem("onboardingComplete", "true");
}

export default function OnboardingRoute() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    store_name: "",
    niche: "",
    average_price: "",
    main_goal: "",
  });

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError("");
  }

  function canContinue() {
    if (step === 0) {
      return form.name.trim() && form.email.trim() && form.password.length >= 6;
    }

    if (step === 1) return form.store_name.trim();
    if (step === 2) return form.niche;
    if (step === 3) return form.average_price;
    if (step === 4) return form.main_goal;

    return true;
  }

  async function submitOnboarding() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/onboarding/create-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          average_price: Number(form.average_price),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Could not create account.");
      }

      saveSession(data);
      navigate("/app");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not finish onboarding.");
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (!canContinue()) {
      setError("Please complete this step before continuing.");
      return;
    }

    if (step === 4) {
      submitOnboarding();
      return;
    }

    setStep((currentStep) => currentStep + 1);
  }

  function back() {
    if (step === 0) {
      navigate("/auth/login");
      return;
    }

    setStep((currentStep) => currentStep - 1);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b16] px-6 text-white">
      <div className="w-full max-w-2xl">
        <div className="mb-12 text-center">
          <div className="text-xl font-black">✧ BlueprintAI</div>
          <p className="mt-2 text-slate-400">
            Create your TikTok Shop workspace
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-10 shadow-2xl">
          {step === 0 && (
            <>
              <h1 className="mb-6 text-3xl font-black">
                Create your account
              </h1>

              <label
                htmlFor="onboarding-name"
                className="mb-2 block text-sm font-bold text-slate-300"
              >
                Name
              </label>
              <input
                id="onboarding-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                placeholder="Your name"
              />

              <label
                htmlFor="onboarding-email"
                className="mb-2 block text-sm font-bold text-slate-300"
              >
                Email
              </label>
              <input
                id="onboarding-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                placeholder="you@example.com"
              />

              <label
                htmlFor="onboarding-password"
                className="mb-2 block text-sm font-bold text-slate-300"
              >
                Password
              </label>
              <input
                id="onboarding-password"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                placeholder="At least 6 characters"
              />
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="mb-6 text-3xl font-black">
                What’s your store name?
              </h1>

              <input
                value={form.store_name}
                onChange={(e) => update("store_name", e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                placeholder="My TikTok Shop"
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mb-6 text-3xl font-black">
                What’s your product niche?
              </h1>

              <div className="grid grid-cols-2 gap-4">
                {niches.map((niche) => (
                  <button
                    type="button"
                    key={niche}
                    onClick={() => update("niche", niche)}
                    className={`rounded-xl border px-4 py-4 font-bold ${
                      form.niche === niche
                        ? "border-cyan-400 bg-cyan-950 text-cyan-100"
                        : "border-slate-700 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {niche}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="mb-6 text-3xl font-black">
                What’s your average product price?
              </h1>

              <input
                type="number"
                value={form.average_price}
                onChange={(e) => update("average_price", e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
                placeholder="29.99"
              />
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="mb-6 text-3xl font-black">
                What’s your main goal?
              </h1>

              <div className="space-y-4">
                {goals.map((goal) => (
                  <button
                    type="button"
                    key={goal}
                    onClick={() => update("main_goal", goal)}
                    className={`w-full rounded-xl border px-4 py-4 text-left font-bold ${
                      form.main_goal === goal
                        ? "border-cyan-400 bg-cyan-950 text-cyan-100"
                        : "border-slate-700 bg-slate-900 text-slate-200"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p className="mt-6 text-red-300">{error}</p>}

          <div className="mt-10 flex justify-between">
            <button
              type="button"
              onClick={back}
              className="rounded-xl border border-slate-600 px-7 py-3 font-bold"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={next}
              disabled={loading}
              className="rounded-xl border border-cyan-400 bg-cyan-500/20 px-7 py-3 font-bold disabled:opacity-50"
            >
              {loading
                ? "Creating..."
                : step === 4
                  ? "Create Account →"
                  : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
