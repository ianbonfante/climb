# TheRutineLab

Guía personalizada de nutrición y ejercicio. Web app estática + una función serverless que genera el plan con IA.

## Estructura

- `index.html` — la app completa (cuestionario + resultado), mobile-first.
- `api/generate.ts` — función Edge de Vercel que recibe el perfil (y hasta 2 fotos) y devuelve el plan en streaming.

## Desplegar en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa este repositorio de GitHub.
2. En **Root Directory** elige `therutinelab`. Framework preset: **Other**.
3. En **Environment Variables** agrega:
   - `ANTHROPIC_API_KEY` (obligatoria) — se crea en [console.anthropic.com](https://console.anthropic.com) → API Keys. Requiere créditos cargados en esa cuenta.
   - `APP_ACCESS_CODE` (opcional) — si la defines, la app solo funciona con el link `https://tu-app.vercel.app/?k=ESE_CODIGO`. Útil mientras el link no es público, para que nadie más gaste tus créditos.
4. Deploy. Comparte el link (con `?k=...` si configuraste el código).

## Costos

Cada generación de plan consume la API de Anthropic desde `ANTHROPIC_API_KEY` (centavos por plan; depende del tamaño del plan y de si lleva fotos). Vercel Hobby es gratis para este uso.
