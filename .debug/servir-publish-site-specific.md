# Servir avec Compassion Publish Diagnosis

## Symptom

`http://localhost:51730/cms/servir-avec-compassion` does not behave like the local Avantech/Sable demo sites when publishing.

## Findings

1. The local CMS uses Convex deployment:

```txt
https://healthy-fox-966.convex.cloud
```

from `.env.local`.

2. The live `https://www.serviraveccompassion.ca/` bundle contains Convex URLs:

```txt
https://shocking-boar-256.convex.cloud
https://happy-otter-123.convex.cloud
```

So the CMS and the live site are not clearly using the same Convex deployment.

3. Earlier browser logs showed this CMS project record has:

```txt
origin: https://www.serviraveccompassion.ca/
editUrl: https://www.serviraveccompassion.ca/
```

Browser `event.origin` is `https://www.serviraveccompassion.ca` with no trailing slash. The CMS compares exactly in `useIframeMessaging`, so a slash in stored `origin` causes iframe messages to be ignored.

4. Local demo sites work because their origins are stored without a slash and they run against the same local/dev Convex configuration.

## Likely Root Cause

For `servir-avec-compassion`, the CMS editor is not equivalent to local demos because project configuration/deployment wiring differs:

- iframe messaging can fail due to trailing-slash origin mismatch;
- publish writes to the CMS Convex deployment, while the live site may read published content from another Convex deployment.

## Minimal Fix Direction

- Normalize `origin` to URL origin form before storing and before comparing, e.g. `new URL(value).origin`.
- Decide which Convex deployment is canonical for `servir-avec-compassion`, then make both the CMS and live site use the same one.
