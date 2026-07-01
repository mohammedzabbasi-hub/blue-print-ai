import { getPrivateMediaObject } from "../utils/upload-storage.server";
import { loadShopifyRouteContext } from "../models/route-context.server";

export async function loader({ request, params }) {
  const { session } = await loadShopifyRouteContext(request);
  try {
    const media = await getPrivateMediaObject({
      shop: session.shop,
      namespace: params.namespace,
      storedFileName: params.filename,
    });
    if (!media.body) throw new Error("Media body is unavailable.");
    const headers = {
        "Cache-Control": "private, max-age=300",
        "Content-Type": media.contentType,
        "X-Content-Type-Options": "nosniff",
      };
    if (media.contentLength) headers["Content-Length"] = String(media.contentLength);
    return new Response(media.body, { headers });
  } catch {
    throw new Response("Media not found.", { status: 404 });
  }
}

export const action = () => new Response("Method not allowed", { status: 405 });
