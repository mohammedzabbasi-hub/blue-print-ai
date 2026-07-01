/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { withEmbeddedRouteParams } from "../utils/embedded-routing";

export function Icon({ name = "sparkles", className = "" }) {
  const glyphs = {
    activity: "↗",
    bag: "▢",
    brief: "▤",
    bulb: "♢",
    calendar: "▣",
    check: "✓",
    cursor: "⌁",
    database: "◫",
    dollar: "$",
    filter: "▽",
    grid: "□",
    key: "⌘",
    layers: "▱",
    logout: "↪",
    list: "☷",
    music: "♪",
    product: "▢",
    rocket: "↟",
    search: "⌕",
    settings: "⚙",
    shield: "◇",
    sparkles: "✦",
    save: "▣",
    support: "◎",
    trash: "⌧",
    upload: "↥",
    users: "♙",
    video: "▷",
    view: "◉",
    warning: "!",
    zap: "ϟ",
  };

  return (
    <span className={`bp-icon ${className}`} aria-hidden="true">
      {glyphs[name] || glyphs.sparkles}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  status,
  action,
  className = "",
}) {
  return (
    <header className={`bp-page-header ${className}`}>
      <div className="bp-page-header-copy">
        {eyebrow && <p className="bp-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {status && <div className="bp-status-row">{status}</div>}
      </div>
      {action && <div className="bp-page-actions">{action}</div>}
    </header>
  );
}

export function StatusBadge({ status = "demo", label }) {
  return (
    <span className={`bp-status-badge bp-status-${status}`}>
      <Icon name={status === "demo" ? "sparkles" : status === "warning" ? "warning" : "check"} />
      {label || status}
    </span>
  );
}

export function PrimaryButton({ children, as: Component = "button", className = "", ...props }) {
  return (
    <Component className={`bp-button bp-button-primary ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function SecondaryButton({ children, as: Component = "button", className = "", ...props }) {
  return (
    <Component className={`bp-button bp-button-secondary ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function GhostButton({ children, as: Component = "button", className = "", ...props }) {
  return (
    <Component className={`bp-button bp-button-ghost ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function Notice({ tone = "info", children }) {
  return (
    <div className={`bp-notice bp-notice-${tone}`}>
      <Icon name={tone === "warning" ? "warning" : "sparkles"} />
      <p>{children}</p>
    </div>
  );
}

export function MetricGrid({ metrics }) {
  return (
    <div className="bp-metric-grid">
      {metrics.map((metric, index) => (
        <MetricCard key={metric.label} metric={metric} tone={metric.tone || (index % 2 ? "shopify" : "primary")} />
      ))}
    </div>
  );
}

export function MetricCard({ metric, tone = "primary" }) {
  const positive = Number(metric.delta || 0) >= 0;

  return (
    <div className="bp-card bp-metric" data-accent={tone}>
      <div className="bp-metric-top">
        <span>{metric.label}</span>
        {metric.icon && <Icon name={metric.icon} />}
      </div>
      <strong>
        {metric.value}
        {metric.unit && <small className="bp-metric-unit">{metric.unit}</small>}
      </strong>
      {typeof metric.delta === "number" ? (
        <p className="bp-metric-delta">
          <span className={positive ? "bp-delta-positive" : "bp-delta-negative"}>
            {positive ? "+" : ""}
            {metric.delta.toFixed(1)}%
          </span>{" "}
          vs. last period
        </p>
      ) : (
        metric.detail && <small>{metric.detail}</small>
      )}
    </div>
  );
}

export function SectionCard({
  heading,
  description,
  icon = "sparkles",
  action,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section className={`bp-section ${className}`}>
      {(heading || action) && (
        <header className="bp-section-header">
          <div className="bp-section-title">
            <Icon name={icon} />
            <div>
              {heading && <h2>{heading}</h2>}
              {description && <p>{description}</p>}
            </div>
          </div>
          {action && <div className="bp-section-action">{action}</div>}
        </header>
      )}
      <div className={`bp-section-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export const DarkSection = SectionCard;

export function ProductPicker({ products, selectedProductId, name = "productId" }) {
  return (
    <label className="bp-field">
      <span>Product</span>
      <select name={name} defaultValue={selectedProductId || products[0]?.id || ""} className="bp-select">
        {products.map((product) => (
          <option value={product.id} key={product.id}>
            {product.title}
            {product.source === "demo" ? " (demo)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProductSummary({ product, compact = false }) {
  if (!product) return null;

  return (
    <div className={compact ? "bp-product-row bp-product-row-compact" : "bp-product-row"}>
      <ProductThumbnail product={product} />
      <div>
        <strong>{product.title}</strong>
        <p>
          {formatMoney(product.price, product.currencyCode)} ·{" "}
          {product.status || "Demo"} · {product.source === "demo" ? "Demo data" : "Shopify product"}
        </p>
      </div>
    </div>
  );
}

export function ProductThumbnail({ product }) {
  const title = product?.title || "Product";

  return (
    <div className="bp-product-image" aria-hidden="true">
      {product?.featuredImage?.url ? (
        <img src={product.featuredImage.url} alt={product.featuredImage.altText || ""} />
      ) : (
        <span>{title.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function ProductCard({ product }) {
  return (
    <div className="bp-product-card">
      <ProductSummary product={product} />
      <div className="bp-product-card-meta">
        <span>{product.variants?.length || 0}</span>
        <small>variants</small>
      </div>
    </div>
  );
}

export function ActionList({ items }) {
  return (
    <div className="bp-list">
      {items.map((item, index) => (
        <ActionCard
          key={item.title}
          eyebrow={`Priority ${index + 1}`}
          title={item.title}
          body={item.detail}
          cta="Open"
          href={item.href}
          glow={index === 0}
        />
      ))}
    </div>
  );
}

export function ActionCard({
  priority,
  eyebrow,
  title,
  body,
  meta,
  cta,
  href,
  glow = false,
}) {
  const location = useLocation();

  return (
    <article className={`bp-action-card ${glow ? "bp-action-card-glow" : ""}`}>
      <div className="bp-action-card-top">
        <div className="bp-action-eyebrow">
          <Icon name="sparkles" />
          {eyebrow && <span>{eyebrow}</span>}
        </div>
        {priority && <span className="bp-priority-badge">{priority} priority</span>}
      </div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {meta && <small>{meta}</small>}
      {href && (
        <Link
          className="bp-link"
          to={withEmbeddedRouteParams(href, location.search)}
        >
          {cta || "Open"} →
        </Link>
      )}
    </article>
  );
}

export function CopyBlock({ label, text }) {
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState("");

  useEffect(() => {
    if (!status) return undefined;
    const timeout = window.setTimeout(() => {
      setStatus("");
      setTone("");
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [status, tone]);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
      setTone("success");
    } catch {
      setStatus("Copy failed");
      setTone("error");
    }
  }

  return (
    <div className="bp-copy-block">
      <div>
        <span>{label}</span>
        <p>{text}</p>
      </div>
      <button
        type="button"
        className={`bp-copy-button ${tone ? `bp-copy-button-${tone}` : ""}`}
        onClick={handleCopy}
      >
        {status || "Copy"}
      </button>
    </div>
  );
}

export function EmptyState({ title, body, actionHref, actionText, icon = "sparkles", checklist }) {
  const location = useLocation();

  return (
    <div className="bp-empty">
      <span className="bp-empty-icon">
        <Icon name={icon} />
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
      {checklist?.length > 0 && (
        <ul>
          {checklist.map((item) => (
            <li key={item}>
              <Icon name="check" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {actionHref && (
        <Link
          className="bp-button bp-button-primary"
          to={withEmbeddedRouteParams(actionHref, location.search)}
        >
          {actionText || "Get started"}
        </Link>
      )}
    </div>
  );
}

export function InsightCard({ label = "AI insight", children }) {
  return (
    <div className="bp-insight-card">
      <Icon name="sparkles" />
      <div>
        <span>{label}</span>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function formatMoney(amount, currencyCode = "USD") {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(Number(amount || 0));
}
