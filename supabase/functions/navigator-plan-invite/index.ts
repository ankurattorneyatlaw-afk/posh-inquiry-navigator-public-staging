const stagingOrigin = 'https://posh-inquiry-navigator-staging.onrender.com';

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply({ error: 'Use the Navigator seat controls.' }, 405);
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return reply({ error: 'Sign in to manage seats.' }, 401);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return reply({ error: 'Request too large.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply({ error: 'Invalid invitation request.' }, 400);
  }
  const { order, email, token } = body ?? {};
  if (typeof order !== 'string' || !/^order_[A-Za-z0-9]{1,40}$/.test(order) ||
    typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return reply({ error: 'Invalid invitation request.' }, 400);
  }
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const admin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !admin) return reply({ error: 'Invitation service is unavailable.' }, 503);

  async function seat(action: string, params: Record<string, string> = {}) {
    const response = await fetch(url + '/rest/v1/rpc/navigator_plan_test_access', {
      method: 'POST',
      headers: { apikey: anon!, Authorization: bearer!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_action: action, p_id: order, ...params }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('Seat authorization failed');
    return response.json();
  }

  try {
    // The database validates the caller's provider-signed session, server token, ownership,
    // active term and seat capacity before the Auth Admin API can send anything.
    const reservation = await seat('invite_reserve', { p_email: email });
    if (!reservation) return reply({ error: 'Only the active plan owner can invite members.' }, 403);
    if (reservation.error || !reservation.invitationId) return reply(reservation);
    const endpoint = new URL('/auth/v1/invite', url);
    endpoint.searchParams.set('redirect_to', stagingOrigin + '/account');
    const sent = await fetch(endpoint, {
      method: 'POST',
      headers: { apikey: admin, Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: reservation.email }),
      signal: AbortSignal.timeout(8000),
    });
    if (!sent.ok) {
      return reply({ error: 'Email delivery could not be confirmed. Check pending invitations before retrying. You can cancel the reservation to free the seat.' });
    }
    const result = await seat('invite_sent', { p_member: reservation.invitationId });
    return reply(result ?? { error: 'This invitation is no longer active.' });
  } catch {
    return reply({ error: 'The invitation could not be completed. Check pending invitations before retrying.' }, 503);
  }
});
