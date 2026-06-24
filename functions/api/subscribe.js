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
    const source = clean(formData.get('source') || formData.get('form_type') || 'Website subscribe form');

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

    const subscriber = { email, name, message, source, listId };
    const welcomeEmailSent = await sendWelcomeEmail(env, apiKey, subscriber);
    const ownerNotificationSent = await sendOwnerNotificationEmail(env, apiKey, subscriber);

    return json({ success: true, welcomeEmailSent, ownerNotificationSent });
  } catch (error) {
    return json({ error: 'Subscription failed. Please try again.' }, 500);
  }
}

export async function onRequestGet() {
  return json({ error: 'Method not allowed.' }, 405);
}

async function sendWelcomeEmail(env, apiKey, subscriber) {
  const senderEmail = clean(env.BREVO_SENDER_EMAIL || env.NOTIFY_EMAIL || 'dailydosedevotions@gmail.com');
  const senderName = clean(env.BREVO_SENDER_NAME || 'Daily Dose Devotions');
  const siteUrl = clean(env.SITE_URL || 'https://dailydosedevotions.ie').replace(/\/$/, '');
  const firstName = clean(subscriber.name).split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: subscriber.email, name: subscriber.name || undefined }],
      replyTo: { email: senderEmail, name: senderName },
      subject: 'Welcome to Daily Dose Devotions',
      htmlContent: renderWelcomeHtml({ greeting, siteUrl }),
      textContent: renderWelcomeText({ greeting, siteUrl })
    })
  });

  return response.ok;
}

async function sendOwnerNotificationEmail(env, apiKey, subscriber) {
  const senderEmail = clean(env.BREVO_SENDER_EMAIL || env.NOTIFY_EMAIL || 'dailydosedevotions@gmail.com');
  const senderName = clean(env.BREVO_SENDER_NAME || 'Daily Dose Devotions');
  const notifyEmail = clean(env.NOTIFY_EMAIL || senderEmail);
  const subscribedAt = new Date().toLocaleString('en-IE', { timeZone: 'Europe/Dublin', dateStyle: 'medium', timeStyle: 'short' });

  if (!notifyEmail) return false;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: notifyEmail, name: 'Daily Dose Devotions' }],
      replyTo: { email: subscriber.email, name: subscriber.name || subscriber.email },
      subject: 'New Daily Dose subscriber',
      htmlContent: renderOwnerNotificationHtml({ subscriber, subscribedAt }),
      textContent: renderOwnerNotificationText({ subscriber, subscribedAt })
    })
  });

  return response.ok;
}

function renderOwnerNotificationHtml({ subscriber, subscribedAt }) {
  const displayName = subscriber.name || 'No name given';
  const message = subscriber.message || 'No message added.';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>New Daily Dose subscriber</title>
  </head>
  <body style="margin:0;padding:0;background:#ede7dc;color:#222824;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ede7dc;margin:0;padding:26px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf1;border:1px solid #d8cbb8;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#233d34;padding:24px 26px;text-align:center;border-bottom:5px solid #c8a968;">
                <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#d9c28f;font-weight:700;">Daily Dose Devotions</div>
                <h1 style="font-family:Georgia,'Times New Roman',serif;margin:10px 0 0;color:#fffaf1;font-size:28px;line-height:1.15;">New Subscriber</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#2c302d;">Someone has subscribed to Daily Dose and has been added or updated in your Brevo list.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #ded2c0;border-radius:6px;">
                  <tr><td style="padding:16px 18px;border-bottom:1px solid #ede4d5;"><strong>Name:</strong> ${escapeHtml(displayName)}</td></tr>
                  <tr><td style="padding:16px 18px;border-bottom:1px solid #ede4d5;"><strong>Email:</strong> ${escapeHtml(subscriber.email)}</td></tr>
                  <tr><td style="padding:16px 18px;border-bottom:1px solid #ede4d5;"><strong>Source:</strong> ${escapeHtml(subscriber.source || 'Website subscribe form')}</td></tr>
                  <tr><td style="padding:16px 18px;border-bottom:1px solid #ede4d5;"><strong>Brevo List ID:</strong> ${escapeHtml(String(subscriber.listId))}</td></tr>
                  <tr><td style="padding:16px 18px;border-bottom:1px solid #ede4d5;"><strong>Subscribed:</strong> ${escapeHtml(subscribedAt)}</td></tr>
                  <tr><td style="padding:16px 18px;"><strong>Message / Prayer:</strong><br>${escapeHtml(message).replaceAll('\n', '<br>')}</td></tr>
                </table>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#776b5f;">The subscriber also receives the Daily Dose welcome email automatically.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderOwnerNotificationText({ subscriber, subscribedAt }) {
  return [
    'New Daily Dose subscriber',
    'Someone has subscribed to Daily Dose and has been added or updated in your Brevo list.',
    `Name: ${subscriber.name || 'No name given'}`,
    `Email: ${subscriber.email}`,
    `Source: ${subscriber.source || 'Website subscribe form'}`,
    `Brevo List ID: ${subscriber.listId}`,
    `Subscribed: ${subscribedAt}`,
    `Message / Prayer: ${subscriber.message || 'No message added.'}`,
    'The subscriber also receives the Daily Dose welcome email automatically.'
  ].join('\n\n');
}

function renderWelcomeHtml({ greeting, siteUrl }) {
  const devotionsUrl = `${siteUrl}/devotions.html`;
  const seriesUrl = `${siteUrl}/series.html`;
  const prayerUrl = `${siteUrl}/#prayer`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome to Daily Dose Devotions</title>
  </head>
  <body style="margin:0;padding:0;background:#ede7dc;color:#222824;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ede7dc;margin:0;padding:30px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf1;border:1px solid #d8cbb8;border-radius:8px;overflow:hidden;box-shadow:0 10px 28px rgba(38,63,54,.10);">
            <tr>
              <td style="background:#233d34;padding:30px 28px 26px;text-align:center;border-bottom:5px solid #c8a968;">
                <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d9c28f;font-weight:700;">Welcome To</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1;color:#fffaf1;font-weight:700;margin-top:10px;">Daily Dose</div>
                <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#efe4d1;margin-top:10px;">Devotions sent with prayer and purpose.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 12px;text-align:center;">
                <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#6f6253;text-transform:uppercase;letter-spacing:1.8px;font-weight:700;">You are subscribed</div>
                <h1 style="margin:16px 0 0;color:#202620;font-size:32px;line-height:1.18;font-weight:700;">Welcome to the Daily Dose family</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0eadf;border-left:4px solid #c8a968;border-radius:4px;">
                  <tr>
                    <td style="padding:18px 20px;text-align:center;">
                      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6f6253;font-weight:700;margin-bottom:6px;">What to expect</div>
                      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#2d5a4e;font-weight:700;">Daily devotions at 7am, and series reflections whenever a series is running.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 34px 8px;">
                <div style="height:1px;background:#ded2c0;margin:0 auto 28px;width:100%;"></div>
                <div style="font-size:18px;line-height:1.78;color:#2c302d;">
                  <p style="margin:0 0 20px;">${escapeHtml(greeting)}</p>
                  <p style="margin:0 0 20px;">Thank you for subscribing to Daily Dose Devotions. I am so glad you are here.</p>
                  <p style="margin:0 0 20px;">Each devotion is written to help you pause, return to the Word, and let God speak into the middle of everyday life.</p>
                  <p style="margin:0 0 20px;">From the next release, you will receive the devotion straight in your inbox when it goes live.</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 4px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 12px;">
                  <tr>
                    <td style="background:#ffffff;border:1px solid #ded2c0;border-radius:6px;padding:18px 18px;">
                      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#9a7832;font-weight:800;margin-bottom:7px;">Install the app</div>
                      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:#3b403c;">You can add Daily Dose to your phone home screen like an app. Open the website on your phone and look for <strong>Install App</strong>, or use your browser menu and choose <strong>Add to Home Screen</strong>.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#ffffff;border:1px solid #ded2c0;border-radius:6px;padding:18px 18px;">
                      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#9a7832;font-weight:800;margin-bottom:7px;">The Sanctuary Prayer Wall</div>
                      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:#3b403c;">If you are carrying something, you can send a prayer request privately or share one for the prayer wall. You do not have to carry it alone.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#ffffff;border:1px solid #ded2c0;border-radius:6px;padding:18px 18px;">
                      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#9a7832;font-weight:800;margin-bottom:7px;">Read anytime</div>
                      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:#3b403c;">You can catch up on past Daily Dose devotions, explore series reflections, and return whenever you need encouragement.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 32px 38px;text-align:center;">
                <a href="${escapeHtml(devotionsUrl)}" style="display:inline-block;background:#2f5c50;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 22px;border-radius:4px;margin:0 4px 10px;">Read Devotions</a>
                <a href="${escapeHtml(prayerUrl)}" style="display:inline-block;background:#c8a968;color:#202620;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 22px;border-radius:4px;margin:0 4px 10px;">Prayer Wall</a>
                <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.8;color:#6f6253;margin-top:4px;">
                  <a href="${escapeHtml(seriesUrl)}" style="color:#2f5c50;font-weight:700;text-decoration:none;">Explore Series</a>
                  <span style="color:#b8aa98;"> | </span>
                  <a href="${escapeHtml(siteUrl)}" style="color:#2f5c50;font-weight:700;text-decoration:none;">Open Website</a>
                </div>
                <div style="height:1px;background:#ded2c0;margin:30px auto 18px;width:72%;"></div>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#776b5f;">Daily Dose Devotions<br>Helping hearts return to the Word, one day at a time.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderWelcomeText({ greeting, siteUrl }) {
  return [
    'Welcome to Daily Dose Devotions',
    greeting,
    'Thank you for subscribing to Daily Dose Devotions. I am so glad you are here.',
    'Daily devotions are sent at 7am, and series reflections are sent whenever a series is running.',
    'From the next release, you will receive the devotion straight in your inbox when it goes live.',
    'You can add Daily Dose to your phone home screen like an app. Open the website on your phone and look for Install App, or use your browser menu and choose Add to Home Screen.',
    `Prayer wall: ${siteUrl}/#prayer`,
    `Read devotions: ${siteUrl}/devotions.html`,
    `Explore series: ${siteUrl}/series.html`
  ].join('\n\n');
}

function clean(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}
