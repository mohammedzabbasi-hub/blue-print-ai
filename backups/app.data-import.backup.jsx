import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildDataImportJobs,
  listWorkspaceRequests,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  Icon,
  Notice,
  PageHeader,
  PrimaryButton,
  SectionCard,
} from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const requests = await listWorkspaceRequests(session.shop, 20);

  return {
    merchantData,
    jobs: buildDataImportJobs(merchantData, requests),
  };
};

export default function DataImport() {
  const { merchantData, jobs } = useLoaderData();

  return (
    <div className="bp-page bp-data-import-page">
      <PageHeader
        eyebrow="Data Import"
        title="Store data pipeline"
        subtitle="Shopify catalog, order, and workspace records normalized for BluePrintAI creative workflows."
        action={
          <PrimaryButton as={Link} to="/app/revenue-blueprint">
            <Icon name="activity" /> Generate blueprint
          </PrimaryButton>
        }
      />

      <div className="bp-section-stack">
        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>{error}</Notice>
        ))}

        <SectionCard
          heading="Import status"
          description="Source-style data import controls adapted to Shopify authenticated data."
          icon="brief"
        >
          <div className="bp-import-list">
            {jobs.map((job) => (
              <article className="bp-import-row" key={job.id}>
                <div>
                  <span>{job.source}</span>
                  <h3>{job.status}</h3>
                  <p>{job.detail}</p>
                </div>
                <dl>
                  <div><dt>Records</dt><dd>{job.records.toLocaleString()}</dd></div>
                  <div><dt>Updated</dt><dd>{job.updatedAt ? formatDate(job.updatedAt) : "Pending"}</dd></div>
                </dl>
                <Link to={job.href}>Open</Link>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard heading="Platform adaptation" icon="shield">
          <ul className="bp-check-list">
            <li><Icon name="check" /> Shopify shop identity is derived from the authenticated session.</li>
            <li><Icon name="check" /> TikTok seller authorization and Partner Center credentials are not imported.</li>
            <li><Icon name="check" /> Demo fallback data is only used when Shopify returns no products.</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
