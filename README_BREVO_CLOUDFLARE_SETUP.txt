DAILY DOSE — BREVO + CLOUDFLARE SIGNUP CONNECTION

This version connects the website subscribe form to Brevo.

WHAT IT DOES
1. Visitor signs up on the Daily Dose website.
2. Cloudflare Pages Function sends the email to Brevo.
3. Contact is added to list ID 2 / Your first list #2.
4. Your active Brevo automation sends the Welcome Pack automatically.

AFTER UPLOADING TO GITHUB
Go to Cloudflare:
Workers & Pages → dailydosedevotions → Settings → Environment variables

Add this variable:
BREVO_API_KEY = your Brevo API key

Optional, only if needed:
BREVO_LIST_ID = 2

Then redeploy the site.

WHERE TO GET BREVO API KEY
Brevo → SMTP & API → API Keys → Generate a new API key.
Copy it once. Do not share it publicly.

TEST
Use a new email address on the website signup form.
Then check Brevo Contacts and your inbox.
