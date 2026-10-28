import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

type StopRecord = {
  id: string;
  title: string;
  address: string;
  categories: string[];
};

type WebhookPayload = {
  type: string;
  table: string;
  schema: string;
  record?: StopRecord;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!webhookSecret || request.headers.get('x-webhook-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = await request.json() as WebhookPayload;
  const stop = payload.record;
  if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'stops' || !stop?.id) {
    return json({ skipped: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey) {
    return json({ error: 'Notification secrets are incomplete' }, 500);
  }

  webpush.setVapidDetails('https://arrowbrooke.github.io/Halloween-Map/', publicKey, privateKey);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth');
  if (error) return json({ error: 'Could not load notification subscriptions' }, 500);

  const categoryNames: Record<string, string> = {
    candy: "Kids' candy",
    adult: 'Adult treats',
    decor: 'Decorations'
  };
  const offerings = (stop.categories || []).map((category) => categoryNames[category] || category).join(' + ');
  const message = JSON.stringify({
    title: 'New Halloween home 🎃',
    body: `${stop.address}${offerings ? `\n${offerings}` : ''}`,
    tag: `new-stop-${stop.id}`,
    url: `https://arrowbrooke.github.io/Halloween-Map/?stop=${encodeURIComponent(stop.id)}`
  });

  let delivered = 0;
  const expired: string[] = [];
  await Promise.all((subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      }, message, { TTL: 86400 });
      delivered += 1;
    } catch (pushError) {
      const statusCode = Number((pushError as { statusCode?: number }).statusCode || 0);
      if (statusCode === 404 || statusCode === 410) expired.push(subscription.endpoint);
      else console.error('Web Push delivery failed', statusCode);
    }
  }));

  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }
  return json({ delivered, expired: expired.length });
});
