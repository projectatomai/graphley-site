// Cloudflare Pages Function: records the visitor's analytics choice in a first-party cookie
// (replaces the two vercel.json header rules) and serves the 1x1 GIF.
export async function onRequestGet({ request, env, next }) {
  const choice = new URL(request.url).searchParams.get('choice');
  const asset = await next();
  if (choice !== 'granted' && choice !== 'denied') return asset;
  const res = new Response(asset.body, asset);
  res.headers.set('Set-Cookie', `analytics_consent=${choice}; Path=/; Max-Age=34560000; Secure; SameSite=Lax`);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
