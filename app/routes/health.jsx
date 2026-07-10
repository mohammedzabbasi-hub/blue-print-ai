export const loader = () =>
  new Response("ok", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 200,
  });

export const action = () =>
  new Response("Method not allowed", {
    headers: { Allow: "GET" },
    status: 405,
  });

export default function HealthRoute() {
  return null;
}
