

# Fix GitHub Build Failure

## Root Cause

The `android/app/build.gradle` has a **hardcoded** dependency on the Thawani Lamsa SDK:

```groovy
implementation("om.thawani:lamsa.sdk:0.0.22")
```

This dependency requires authentication to a **private Maven repository** (`maven.pkg.github.com/ThawaniMobile/Lamsa-SDK`). Without valid `THAWANI_MAVEN_USER` and `THAWANI_MAVEN_TOKEN` GitHub secrets, Gradle cannot resolve this dependency and the build fails with exit code 1.

The previous working build had this dependency injected **conditionally** by the workflow only when credentials were present. Claude's changes likely removed that conditional logic and hardcoded it directly into `build.gradle`.

## Fix

### 1. Make the SDK dependency conditional in `android/app/build.gradle`

Replace the hardcoded `implementation("om.thawani:lamsa.sdk:0.0.22")` with a conditional check:

```groovy
if (System.getenv("THAWANI_MAVEN_USER")?.trim()) {
    implementation("om.thawani:lamsa.sdk:0.0.22")
}
```

This way the app compiles with or without the SDK. The reflection-based `ThawaniLamsaPlugin.java` already handles both cases gracefully (returns `SDK_NOT_AVAILABLE` when the SDK classes aren't found).

### 2. Make the Maven repository conditional in `android/build.gradle`

Same pattern for the top-level Maven repo — wrap the Thawani Maven block so it doesn't fail authentication when credentials are empty:

```groovy
if (System.getenv("THAWANI_MAVEN_USER")?.trim()) {
    maven {
        url "https://maven.pkg.github.com/ThawaniMobile/Lamsa-SDK"
        credentials { ... }
    }
}
```

### 3. Keep the workflow simple

The workflow already passes `THAWANI_MAVEN_USER` and `THAWANI_MAVEN_TOKEN` as env vars during the Gradle build step. No workflow changes needed — the conditional logic moves into Gradle itself where it belongs.

## Result

- **Without Maven credentials**: Build succeeds, APK works with payment gateway only, Soft POS returns "SDK not available"
- **With Maven credentials**: Build succeeds, APK includes real Lamsa SDK for NFC payments

No new repository needed. This is a 2-file fix.

