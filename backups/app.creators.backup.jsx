/* eslint-disable react/prop-types */
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildCreators,
  createWorkspaceRequest,
  listSavedCreatives,
  listWorkspaceRequests,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  EmptyState,
  Icon,
  Notice,
  PageHeader,
  PrimaryButton,
  ProductThumbnail,
  SecondaryButton,
  SectionCard,
} from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const savedCreatives = await listSavedCreatives(session.shop, 50);
  const workspaceRequests = await listWorkspaceRequests(session.shop, 50);
  const creatorRequests = workspaceRequests.filter(
    (request) => request.type === "creator_outreach",
  );

  return {
    merchantData,
    creators: buildCreators(merchantData.products, savedCreatives),
    requestedCreatorIds: creatorRequests
      .map((request) => request.payload?.creatorId)
      .filter(Boolean),
    creatorRequests,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "request_creator_outreach") {
    return { message: "No creator action was selected." };
  }

  const creatorName = String(formData.get("creatorName") || "Creator");
  const productTitle = String(formData.get("productTitle") || "selected product");

  await createWorkspaceRequest(session.shop, "creator_outreach", {
    creatorId: String(formData.get("creatorId") || ""),
    creatorName,
    productId: String(formData.get("productId") || ""),
    productTitle,
    specialty: String(formData.get("specialty") || ""),
    requestedAt: new Date().toISOString(),
  });

  return {
    message: `${creatorName} was added to the outreach queue for ${productTitle}.`,
  };
};

export default function Creators() {
  const { merchantData, creators, requestedCreatorIds, creatorRequests } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const requestedSet = new Set(requestedCreatorIds);

  return (
    <div className="bp-page bp-creators-page">
      <PageHeader
        eyebrow="Creators"
        title="Creator pipeline"
        subtitle="Match products with creator angles, saved creative analyses, and product-specific briefs."
        action={
          <PrimaryButton as={Link} to="/app/ad-briefs?generate=1">
            <Icon name="brief" /> Build creator brief
          </PrimaryButton>
        }
      />

      <div className="bp-section-stack">
        {actionData?.message && (
          <Notice tone="info">{actionData.message}</Notice>
        )}

        {merchantData.errors.map((error) => (
          <Notice tone="warning" key={error}>{error}</Notice>
        ))}

        {!creators.length ? (
          <EmptyState
            title="No creator matches yet"
            body="Add Shopify products to generate creator matches and campaign directions."
            actionHref="/app/data-import"
            actionText="Review imports"
          />
        ) : (
          <>
            <div className="bp-creator-metrics">
              <Metric label="Active creators" value={creators.filter((item) => item.status === "Active").length} />
              <Metric label="Avg fit score" value={`${Math.round(creators.reduce((sum, item) => sum + item.fitScore, 0) / creators.length)}/100`} />
              <Metric label="Creative concepts" value={creators.reduce((sum, item) => sum + item.creativeCount, 0)} />
              <Metric label="Outreach queued" value={creatorRequests.length} />
            </div>

            <SectionCard
              heading="Creator shortlist"
              description="Source-style creator cards backed by Shopify product context."
              icon="support"
              action={<SecondaryButton as={Link} to="/app/creative-library">Open creatives</SecondaryButton>}
            >
              <div className="bp-creator-grid">
                {creators.map((creator) => (
                  <CreatorCard
                    creator={creator}
                    isSubmitting={isSubmitting}
                    key={creator.id}
                    requested={requestedSet.has(creator.id)}
                  />
                ))}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bp-creator-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CreatorCard({ creator, requested, isSubmitting }) {
  return (
    <article className="bp-creator-card">
      <div className="bp-creator-card-top">
        <div className="bp-creator-avatar" aria-hidden="true">
          {creator.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}
        </div>
        <div>
          <h3>{creator.name}</h3>
          <p>{creator.handle} · {creator.status}</p>
        </div>
        <span>{creator.fitScore}</span>
      </div>
      <div className="bp-creator-product">
        <ProductThumbnail product={{ title: creator.productTitle }} />
        <div>
          <span>Best product match</span>
          <strong>{creator.productTitle}</strong>
        </div>
      </div>
      <p>{creator.projectedImpact}</p>
      <dl className="bp-creator-stats">
        <div><dt>Specialty</dt><dd>{creator.specialty}</dd></div>
        <div><dt>Hook</dt><dd>{creator.avgHookScore}/100</dd></div>
        <div><dt>Response</dt><dd>{creator.responseRate}</dd></div>
      </dl>
      <div className="bp-creator-actions">
        <Link to={`/app/creators/${encodeURIComponent(creator.id)}`}>View profile</Link>
        <Link to={`/app/ad-briefs?productId=${encodeURIComponent(creator.productId)}&generate=1`}>Create brief</Link>
        <Form method="post">
          <input type="hidden" name="intent" value="request_creator_outreach" />
          <input type="hidden" name="creatorId" value={creator.id} />
          <input type="hidden" name="creatorName" value={creator.name} />
          <input type="hidden" name="productId" value={creator.productId} />
          <input type="hidden" name="productTitle" value={creator.productTitle} />
          <input type="hidden" name="specialty" value={creator.specialty} />
          <button type="submit" disabled={requested || isSubmitting}>
            {requested ? "Queued" : "Queue outreach"}
          </button>
        </Form>
      </div>
    </article>
  );
}
