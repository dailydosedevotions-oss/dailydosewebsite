export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.BREVO_API_KEY;
  const listId = Number(env.BREVO_LIST_ID || 2);

  if (!apiKey) {
    return json({ error: 'Brevo API key is not configured.' }, 500);
  }

  try {
    const formData = await request.formData();
    const name = clean(formData.get('name'));
    const email = clean(formData.get('email')).toLowerCase();
    const message = clean(formData.get('message'));

    if (!email || !email.includes('@')) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    const attributes = {};
    if (name) attributes.FIRSTNAME = name;
    if (message) attributes.MESSAGE = message;

    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [listId],
        updateEnabled: true
      })
    });

    const data = await brevoResponse.json().catch(() => ({}));

    if (!brevoResponse.ok) {
      return json({ error: data.message || 'Brevo could not add this contact.' }, 400);
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: 'Subscription failed. Please try again.' }, 500);
  }
}

export async function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}

function clean(value) {
  return String(value || '').trim();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}
