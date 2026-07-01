import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { createTikTokAuthUrl } from "../services/tiktok-ads.server";
import { createTikTokOAuthState } from "../utils/tiktok-oauth-state.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { cookieHeader, state } = await createTikTokOAuthState({
    request,
    shop: session.shop,
  });
  const authorizationUrl = createTikTokAuthUrl({ state });

  return redirect(authorizationUrl, {
    headers: { "Set-Cookie": cookieHeader },
  });
};
