---
name: ops
description: "Operations perspective. Load when deploying, managing infrastructure, checking service health, configuring clusters, or auditing cross-repo configs. Focused on what's cheap, what's safe, and what's already running."
authority: 5
---

# Ops

Know what's running. Know what it costs. Don't break production to fix a typo.

## Deployment Awareness

- **Always check replica count before designing per-JVM features.** `kubectl get deployments -n {namespace}` shows replica count in 2 seconds. Per-JVM state (caches, swaps, toggles) behind a load balancer requires broadcast, shared external state, or single replica.
- **When swapping state across multiple pods:** call the endpoint N times (N > replica count), then verify with M consecutive `get` calls that ALL return the target.
- **After a git push, don't suggest kubectl.** Pushing to dev/qa/etc triggers Rio CI -> Spinnaker deploy automatically. Don't suggest `kubectl rollout restart` on top of a push.

## Operation Cost Awareness

| Operation | Time | When to use |
|-----------|------|-------------|
| `kubectl rollout restart` | ~60s | Secret/config changes, no code change |
| SBT compile + test | ~5-10 min | Local code changes before pushing |
| Rio build | ~10-15 min | Code changes that need CI (triggered by push) |
| Spinnaker deploy | ~5-15 min | Runs automatically after Rio build |
| Full push-to-deploy | ~25 min | Code changes end-to-end |

- **Choose the cheapest operation.** Don't trigger a 25-min Rio cycle when a 60s kubectl restart suffices.
- **Never suggest a redundant operation.** If a push already triggers CI/CD, don't also suggest kubectl.
- **Ask "What actually changed?"** Code change -> Rio. Config/secret change -> kubectl restart. Nothing changed -> don't restart.

## Cross-Repo Config Auditing

- **Before modifying ANY config value (Kafka, Cassandra, gRPC), check the source service repo first.** TGS doesn't invent config values — it must match what downstream services expect.
- **Config values that MUST match across repos:** Kafka client IDs, topic names, Cassandra cluster names, keyspace names, bootstrap servers, secret file name patterns. A mismatch means auth failure, wrong topic, or wrong cluster at runtime.
- **When creating a new environment config:** copy values from the corresponding source repo config, not from another environment in the same repo. DEV values differ from beta values.

## Infrastructure Safety

- **Never destroy a working environment without a recovery plan.** `rm -rf .venv` or `docker system prune` during a proxy outage means you can't rebuild.
- **Check `colima status` before assuming Docker is broken.** This user runs Colima, not Docker Desktop.
- **Whisper secrets are per-cluster.** Check that the secret's configured buckets include the target deployment before writing code that needs new credentials.
