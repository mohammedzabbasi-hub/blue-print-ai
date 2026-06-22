import { useState } from "react";
import { Link, useNavigate } from "react-router";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const DASHBOARD_PATH = "/app";

const demoAccounts = [
  {
    name: "GlowLab Beauty Team",
    email: "beauty@demo.com",
    shops: "1",
  },
  {
    name: "FitPulse Gear Team",
    email: "fitness@demo.com",
    shops: "2",
  },
  {
    name: "HomeEase Finds Team",
    email: "home@demo.com",
    shops: "3",
  },
  {
    name: "BlueprintAI Agency Demo",
    email: "agency@demo.com",
    shops: "1, 2, 3, 4, 5",
  },
];

export const meta = () => {
  return [{ title: "Login | BluePrintAI" }];
};

export default function LoginRoute() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("beauty@demo.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function goToDashboard() {
    navigate(DASHBOARD_PATH, { replace: true });
  }

  async function handleLogin(e) {
    e?.preventDefault();

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/auth/app-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Login failed.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("token", data.token);
        window.localStorage.setItem("access_token", data.token);
        window.localStorage.setItem("authToken", data.token);

        window.localStorage.setItem("user", JSON.stringify(data.user));
        window.localStorage.setItem("selectedShop", JSON.stringify(data.shop));

        if (data.shop?.id) {
          window.localStorage.setItem("selectedShopId", String(data.shop.id));
          window.localStorage.setItem("shop_id", String(data.shop.id));
        }

        window.localStorage.setItem("onboardingComplete", "true");
      }

      goToDashboard();
    } catch (err) {
      console.error(err);

      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(
          `Could not reach the backend at ${API_BASE}. Start the FastAPI server or set VITE_API_BASE_URL.`
        );
      } else {
        setError(err.message || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(account) {
    setEmail(account.email);
    setPassword("demo123");
    setError("");
  }

  return (
    <div className="min-h-screen bg-[#070b16] px-8 py-12 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-10">
          <p className="font-black uppercase tracking-[0.3em] text-cyan-400">
            BlueprintAI Login
          </p>

          <h1 className="mt-6 text-6xl font-black">Sign in</h1>

          <p className="mt-6 text-xl text-slate-400">
            Sign in with a demo account or an account created during onboarding.
          </p>

          <p className="mt-4 text-sm leading-6 text-slate-500">
            Current MVP supports demo accounts, onboarding-created workspaces,
            manual import, and creative upload/analysis. TikTok Shop OAuth is
            not live yet.
          </p>

          <form onSubmit={handleLogin} className="mt-12">
            <label
              htmlFor="demo-login-email"
              className="mb-3 block font-bold text-slate-300"
            >
              Email
            </label>

            <input
              id="demo-login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-lg text-white"
              placeholder="you@example.com"
            />

            <label
              htmlFor="demo-login-password"
              className="mb-3 mt-8 block font-bold text-slate-300"
            >
              Password
            </label>

            <input
              id="demo-login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-lg text-white"
              placeholder="Password"
            />

            {error && <p className="mt-5 text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-lg font-black text-white disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#0b1220] p-10">
          <h2 className="text-4xl font-black">Demo Accounts</h2>

          <p className="mt-4 text-xl text-slate-400">
            Each account has different shop access.
          </p>

          <div className="mt-10 space-y-5">
            {demoAccounts.map((account) => (
              <button
                type="button"
                key={account.email}
                onClick={() => fillDemo(account)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-left transition hover:border-cyan-500"
              >
                <h3 className="text-2xl font-black">{account.name}</h3>

                <p className="mt-2 font-bold text-cyan-300">
                  {account.email}
                </p>

                <p className="mt-2 font-bold text-slate-400">
                  Password: demo123 · Shops: {account.shops}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-cyan-900 bg-cyan-950/20 p-6">
            <h3 className="text-xl font-black">New user?</h3>

            <p className="mt-2 text-slate-400">
              Create a real shop workspace through onboarding, then come back
              and log in using that email and password.
            </p>

            <button
              type="button"
              onClick={() => navigate("/onboarding")}
              className="mt-5 rounded-xl border border-cyan-400 px-5 py-3 font-bold text-cyan-200"
            >
              Create Account →
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-wrap justify-center gap-5 text-sm font-bold text-slate-500">
        <Link to="/privacy" className="hover:text-cyan-200">
          Privacy
        </Link>

        <Link to="/terms" className="hover:text-cyan-200">
          Terms
        </Link>

        <Link to="/support" className="hover:text-cyan-200">
          Support
        </Link>
      </div>
    </div>
  );
}
