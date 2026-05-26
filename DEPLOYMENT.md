# CalmCampus Render Deployment

CalmCampus must be deployed as a Render Web Service, not a Static Site, because `/api/talk` runs on the server and uses provider API keys from server-side environment variables.

## Render Steps

1. Go to [render.com](https://render.com).
2. Select New -> Web Service.
3. Connect the CalmCampus GitHub repository.
4. Use Runtime: Node. Use Node 22.12 or newer.
5. Set Build Command:

```bash
npm install && npm run build
```

6. Set Start Command:

```bash
npm run start
```

7. Add the environment variables listed below in the Render dashboard.
8. Deploy.
9. After deployment, test `/dashboard` and `/talk` on the Render public URL.

## Render Environment Variables

Paste only the values you have. Leave unused providers unset.

```bash
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
MISTRAL_API_KEY=
SAMBANOVA_API_KEY=
CEREBRAS_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
HF_TOKEN=
GITHUB_TOKEN=
COHERE_API_KEY=
NVIDIA_API_KEY=
PUBLIC_APP_URL=https://calmcampus.onrender.com
```

## Production Notes

- Render provides `PORT`; the production server reads `process.env.PORT` and listens on `0.0.0.0`.
- Provider API keys are read only on the server by `/api/talk`.
- Do not prefix provider secret keys with `VITE_`.
- Do not deploy this as a Render Static Site, because static hosting will not run `/api/talk`.
