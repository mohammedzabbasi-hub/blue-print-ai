import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildCreators,
  createWorkspaceRequest,
  findCreator,
  listSavedCreatives,
  listWorkspaceRequests,
  loadMerchantData,
} from "../models/blueprint.server";
import {
  EmptyState,
  Icon,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
} from "../components/blueprint-ui";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const merchantData = await loadMerchantData(admin, session);
  const savedCreatives = await listSavedCreatives(session.shop, 50);
  const creators = buildCreators(merchantData.products, savedCreatives);
  const creator = findCreator(creators, params.creatorId);
  const workspaceRequests = await listWorkspaceRequests(session.shop, 50);
  const requested = workspaceRequests.some(
    (request) =>
      request.type === "creator_outreach" &&
      request.payload?.creatorId === creator?.id,
  );

  return {
    creator,
    requested,
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

export default function CreatorDetail() {
  const { creator, requested } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (!creator) {
    return (
      <div className="bp-page">
        <EmptyState
          title="Creator not found"
          body="This creator profile is not available for the authenticated Shopify shop."
          actionHref="/app/creators"
          actionText="Back to creators"
        />
      </div>
    );
  }

  return (
    <div className="bp-page bp-creator-detail-page">
      <PageHeader
        eyebrow="Creator Detail"
        title={creator.name}
        subtitle={`${creator.handle} · ${creator.specialty} · ${creator.productTitle}`}
        action={
          <PrimaryButton as={Link} to={`/app/ad-briefs?productId=${encodeURIComponent(creator.productId)}&generate=1`}>
            <Icon name="brief" /> Create brief
          </PrimaryButton>
        }
      />

      <div className="bp-creator-detail-grid">
        <SectionCard heading="Creator fit" icon="sparkles">
          {actionData?.message && (
            <div className="bp-insight-card">
              <Icon name="check" />
              <p>{actionData.message}</p>
            </div>
          )}
          <div className="bp-fit-score">
            <strong>{creator.fitScore}</strong>
            <span>fit score</span>
          </div>
          <p>{creator.projectedImpact}</p>
          <dl className="bp-creator-stats bp-creator-stats-large">
            <div><dt>Average hook score</dt><dd>{creator.avgHookScore}/100</dd></div>
            <div><dt>Response rate</dt><dd>{creator.responseRate}</dd></div>
            <div><dt>Creative count</dt><dd>{creator.creativeCount}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard
          heading="Campaign direction"
          description="Source creator workflow adapted to Shopify product context."
          icon="activity"
          action={<SecondaryButton as={Link} to="/app/creators">Back</SecondaryButton>}
        >
          <ul className="bp-check-list">
            {creator.notes.map((note) => (
              <li key={note}><Icon name="check" /> {note}</li>
            ))}
          </ul>
          <Form method="post" className="bp-creator-detail-actions">
            <input type="hidden" name="intent" value="request_creator_outreach" />
            <input type="hidden" name="creatorId" value={creator.id} />
            <input type="hidden" name="creatorName" value={creator.name} />
            <input type="hidden" name="productId" value={creator.productId} />
            <input type="hidden" name="productTitle" value={creator.productTitle} />
            <input type="hidden" name="specialty" value={creator.specialty} />
            <PrimaryButton as="button" type="submit" disabled={requested || isSubmitting}>
              <Icon name="support" /> {requested ? "Outreach queued" : "Queue outreach"}
            </PrimaryButton>
          </Form>
        </SectionCard>
      </div>

      <SectionCard heading="Associated creatives" icon="video">
        {creator.creatives.length ? (
          <div className="bp-search-results">
            {creator.creatives.map((creative) => (
              <Link className="bp-search-result" to={creative.href} key={creative.id}>
                <span className="bp-search-result-icon"><Icon name="video" /></span>
                <span>
                  <strong>{creative.title}</strong>
                  <small>{creative.angle}</small>
                </span>
                <em>Open</em>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved creative yet"
            body="Analyze a video or save a concept to associate it with this product match."
            actionHref={`/app/video-analysis?productId=${encodeURIComponent(creator.productId)}`}
            actionText="Analyze creative"
          />
        )}
      </SectionCard>
    </div>
  );
}
