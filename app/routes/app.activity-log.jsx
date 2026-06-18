import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildActivityEvents,
  listRevenueBlueprints,
  listSavedBriefs,
  listSavedCreatives,
  listVideoAnalyses,
  listWorkspaceRequests,
} from "../models/blueprint.server";
import {
  EmptyState,
  Icon,
  PageHeader,
  SecondaryButton,
  SectionCard,
} from "../components/blueprint-ui";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const [briefs, creatives, analyses, blueprints, requests] = await Promise.all([
    listSavedBriefs(session.shop, 25),
    listSavedCreatives(session.shop, 25),
    listVideoAnalyses(session.shop, 25),
    listRevenueBlueprints(session.shop, 25),
    listWorkspaceRequests(session.shop, 25),
  ]);

  return {
    events: buildActivityEvents({ briefs, creatives, analyses, blueprints, requests }),
  };
};

export default function ActivityLog() {
  const { events } = useLoaderData();

  return (
    <div className="bp-page bp-activity-page">
      <PageHeader
        eyebrow="Activity Log"
        title="Workspace activity"
        subtitle="Recent briefs, analyses, saved creatives, blueprints, exports, and integration operations."
        action={<SecondaryButton as={Link} to="/app/settings"><Icon name="settings" /> Settings</SecondaryButton>}
      />

      <SectionCard heading="Timeline" icon="calendar">
        {!events.length ? (
          <EmptyState
            title="No activity yet"
            body="Generate a brief, analyze a creative, or create a revenue blueprint to populate this log."
            actionHref="/app/ad-briefs"
            actionText="Generate brief"
          />
        ) : (
          <ol className="bp-activity-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="bp-activity-dot" />
                <div>
                  <span>{event.type} · {formatDate(event.createdAt)}</span>
                  <h3>{event.title}</h3>
                  <p>{event.detail}</p>
                </div>
                <Link to={event.href}>Open</Link>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
