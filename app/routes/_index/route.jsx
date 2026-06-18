import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

const publicStyles = {
  page: {
    alignItems: "center",
    background: "#f8fafc",
    color: "#0f172a",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "1rem",
    textAlign: "center",
    width: "100%",
  },
  content: {
    display: "grid",
    gap: "2rem",
  },
  heading: {
    margin: 0,
    padding: 0,
  },
  text: {
    fontSize: "1.2rem",
    margin: 0,
    padding: "0 0 2rem",
  },
  form: {
    alignItems: "center",
    display: "flex",
    gap: "1rem",
    justifyContent: "flex-start",
    margin: "0 auto",
  },
  label: {
    display: "grid",
    fontSize: "1rem",
    gap: "0.2rem",
    maxWidth: "20rem",
    textAlign: "left",
  },
  input: {
    padding: "0.4rem",
  },
  button: {
    padding: "0.4rem",
  },
  list: {
    display: "flex",
    gap: "2rem",
    listStyle: "none",
    margin: 0,
    padding: "3rem 0 0",
  },
  listItem: {
    maxWidth: "20rem",
    textAlign: "left",
  },
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div
      className={styles.index}
      style={publicStyles.page}
    >
      <div className={styles.content} style={publicStyles.content}>
        <h1 className={styles.heading} style={publicStyles.heading}>
          BluePrintAI
        </h1>
        <p className={styles.text} style={publicStyles.text}>
          Turn Shopify catalog context into creative briefs, ad analysis,
          recommendations, and a weekly growth plan.
        </p>
        {showForm && (
          <Form
            className={styles.form}
            method="post"
            action="/auth/login"
            style={publicStyles.form}
          >
            <label className={styles.label} style={publicStyles.label}>
              <span>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                style={publicStyles.input}
              />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit" style={publicStyles.button}>
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list} style={publicStyles.list}>
          <li style={publicStyles.listItem}>
            <strong>Catalog-aware creative</strong>. Generate product-specific
            hooks, captions, scripts, and visual concepts.
          </li>
          <li style={publicStyles.listItem}>
            <strong>Saved workspace history</strong>. Keep briefs, analyses,
            and blueprints tied to the connected shop.
          </li>
          <li style={publicStyles.listItem}>
            <strong>Shopify-native auth</strong>. Merchants sign in through
            Shopify OAuth and app sessions stay server-side.
          </li>
        </ul>
      </div>
    </div>
  );
}
