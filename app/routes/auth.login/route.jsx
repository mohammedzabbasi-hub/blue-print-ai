import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (process.env.NODE_ENV === "production") {
    if (url.searchParams.has("shop")) {
      await login(request);
    }
    return { errors: {}, manualLoginAllowed: false };
  }

  const errors = loginErrorMessage(await login(request));

  return { errors, manualLoginAllowed: true };
};

export const action = async ({ request }) => {
  if (process.env.NODE_ENV === "production") {
    return new Response("Open BluePrintAI from Shopify Admin.", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  const errors = loginErrorMessage(await login(request));

  return {
    errors,
    manualLoginAllowed: true,
  };
};

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors, manualLoginAllowed } = actionData || loaderData;

  if (!manualLoginAllowed) {
    return (
      <AppProvider embedded={false}>
        <main className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h1 className="text-3xl font-black text-slate-950">
            Open BluePrintAI from Shopify Admin
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            BluePrintAI uses your existing Shopify sign-in. Open Shopify Admin,
            choose Apps, and select BluePrintAI. If the app is not installed,
            install it from its Shopify App Store listing first.
          </p>
          <a
            className="mt-8 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-bold text-white"
            href="https://admin.shopify.com"
          >
            Open Shopify Admin
          </a>
        </main>
      </AppProvider>
    );
  }

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
          <s-section heading="Log in">
            <s-text-field
              name="shop"
              label="Shop domain"
              details="example.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={errors.shop}
            ></s-text-field>
            <s-button type="submit">Log in</s-button>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
