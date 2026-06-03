# Bezpečnosť a súkromie

Princíp: **privacy-by-design** s pseudonymizáciou. Pri deťoch sme zámerne
konzervatívnejší (minimalizácia dát, obmedzenie účelu, žiadne zbytočné PII).

## Kľúče a tajomstvá

| Premenná | Kde žije | Pravidlo |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV` | frontend + server | Smie ísť do bundlu (chránené RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | len server | Obchádza RLS. **Nikdy** do frontendu. |
| `ANTHROPIC_API_KEY` | len server | **Nikdy** do frontendu. |

- Iba `VITE_`-prefixované premenné Vite vystaví prehliadaču.
- `backend/lib/supabaseAdmin.ts` je server-only (komentár + automatický test).
- Reálny `.env` sa **necommituje** (`.gitignore`); v repe je len `.env.example`.

## Pseudonymizácia

- Žiaci vystupujú pod **aliasom** (napr. `Líška-07`), nie pod reálnym menom.
- `profiles.display_name` drží pseudonym; reálne e-maily žijú len v
  Supabase-spravovanej tabuľke `auth.users`.
- Seed a mock dáta neobsahujú **žiadne** reálne mená ani e-maily detí
  (stráži `tests/security/noPersonalData.test.ts`).

## RLS (Row Level Security)

Zapnutá na všetkých používateľských/školských tabuľkách. Stručne:
žiak vidí len svoje dáta; učiteľ vidí žiakov svojich tried; katalóg je
čitateľný pre prihlásených; zápisy AI/progres idú cez service role.
Detaily a limity: [DATABASE.md](DATABASE.md).

## Upload (cieľový stav)

- Limit veľkosti cez `MAX_UPLOAD_MB` (default 8).
- Whitelist typov dôkazov: `text`, `link`, `image`, `file`.
- Validácia na serveri pred uložením; v tejto iterácii reálny upload nie je
  implementovaný.

## Vercel security headers

`vercel.json` nastavuje: `Content-Security-Policy` (konzervatívna, povoľuje
Supabase domény cez `connect-src`), `Referrer-Policy`,
`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`,
`Permissions-Policy`.

> Poznámka k CSP: `style-src` zatiaľ obsahuje `'unsafe-inline'` kvôli inline
> štýlom v MVP. Pri tvrdení produkcie presunúť inline štýly do tried a
> `'unsafe-inline'` odstrániť.

## Rate limiting

Pripravené premenné `RATE_LIMIT_WINDOW_MS` a `RATE_LIMIT_MAX` pre budúce
obmedzenie AI endpointu.
