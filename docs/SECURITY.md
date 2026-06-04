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
- `backend/lib/supabaseAdmin.ts` a `backend/lib/anthropicClient.ts` sú
  server-only (komentár + automatické testy `noAiSecretsInFrontend`).
- Reálny `.env` sa **necommituje** (`.gitignore`); v repe je len `.env.example`.

## Čo sa neposiela do AI

Do Claude/Anthropic posielame iba mission metadata + anonymizovanú prácu žiaka.
**Nikdy** sa neposiela: meno/email žiaka, názov školy (ak nie nutný), session
token, access code, Supabase IDs, interné hashe ani API kľúče. Raw prompty sa
**neukladajú** do DB (`AI_VALIDATION_LOG_RAW_PROMPTS=false`). Detaily:
[AI_VALIDATION.md](AI_VALIDATION.md).

## Pseudonymizácia

- Žiaci vystupujú pod **aliasom** (napr. `Líška-07`), nie pod reálnym menom.
- `profiles.display_name` drží pseudonym; reálne e-maily žijú len v
  Supabase-spravovanej tabuľke `auth.users`.
- Seed a mock dáta neobsahujú **žiadne** reálne mená ani e-maily detí
  (stráži `tests/security/noPersonalData.test.ts`).

## Role a prístup

INVOk rozlišuje tri role (`profiles.role`): **admin školy**, **učiteľ**, **žiak**.

- **Učiteľ / admin** sa prihlasujú cez Supabase Auth (e-mail/heslo, magic-link
  pripravenosť). Identitu drží `auth.users`; rolu a pseudonym `profiles`.
- **Žiak – pseudonymný prístup (bez e-mailu):** pripojí sa do triedy **kódom**
  + zvolenou prezývkou (napr. `Líška-07`) a dostane **nepriehľadný session
  token** (klientovi sa vráti raz; ukladá sa len jeho hash). V app tabuľkách
  **neukladáme** e-mail ani reálne meno žiaka.

**Nikdy v plaintexte:** prístupové kódy ani session tokeny — v DB je len ich
`sha256` hash (`code_hash`, `session_token_hash`), ktorý sa **nevracia** cez
verejné student API (stráži `tests/security/studentAccess.test.ts`).

**Teacher review:** `teacher_reviews` má RLS – číta reviewer / správca triedy /
vlastník odovzdania; zapisuje len správca triedy. Review API nevracia hashe ani
secrets (stráži `tests/security/teacherReviewAccess.test.ts`).

**Mock vs produkcia:** bez Supabase tajomstiev bežia `authService` (frontend) aj
`studentAccessService` (server) v bezpečnom **mock/demo** režime
(`source: 'mock'`); pri konfigurácii sa použije DB-ready cesta (`source: 'db'`).
Tabuľky: `supabase/migrations/002_auth_and_student_access.sql`.

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
