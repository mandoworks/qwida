# VAPID Keys for Web Push Notifications

To generate VAPID keys for family push notifications, run the following command once:

```bash
npx web-push generate-vapid-keys
```

This command prints:
- `Public Key`
- `Private Key`

## Adding Keys to Vercel

Add each key to Vercel environment variables:

```bash
vercel env add VAPID_PUBLIC_KEY
vercel env add VAPID_PRIVATE_KEY
vercel env add VAPID_SUBJECT
```

For `VAPID_SUBJECT`, enter a mailto URI such as `mailto:hola@mando.works`.
