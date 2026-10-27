# Dependency decisions

The lockfile is authoritative. `npm ci` installs its resolved versions; `expo install --check` verifies native module alignment. Root overrides keep broad peer ranges on the same Expo/React/React Native/native-screen versions. Mixing Expo SDKs in one Android native build is invalid.

The initial documented WebRTC combination was Expo 56 / WebRTC 124.0.7 / config plugin 15.0.2. Expo Doctor identified a Hermes memory regression in SDK 56 and recommended patched SDK 57 / React Native 0.86.2+. The project uses Expo 57.0.31 / RN 0.86.3. Config plugin 15.0.2 declares `expo >=56`, but its upstream table only documents SDK 56 explicitly. Android compilation and device validation are still required to establish compatibility for this chosen combination. React Native Directory's “untested on New Architecture” WebRTC warning remains visible.

TweetNaCl is an established audited JavaScript NaCl implementation. Its box API works without a custom native crypto bridge. Expo Crypto supplies its random bytes via `setPRNG` during startup; Node uses its built-in secure randomness in tests. A future native sodium implementation could reduce JavaScript handling of key material, but is not needed to implement the current encryption construction correctly. No Signal protocol is claimed.

Prisma 6.19.3 retains the conventional generated client and SQLite engine API. Moving to Prisma 7+ requires adopting its changed configuration/adapter APIs rather than updating the dependency alone. The vulnerable `deepmerge-ts` configuration dependency is overridden to 8.0.2, with migration/build/integration checks run after the change. Project request validation uses patched Zod 4.6.7. No insecure downgrade of Expo is used to silence audit results.

See `docs/implementation-status.md` for the last actual audit and doctor outcomes. Upstream toolchain advisories do not justify claiming a clean dependency audit or a production security review.
