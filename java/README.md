# cimp-connect for Java / Spring Boot

Connect a Java backend to a **CIMP** support portal. Same contract as the npm
package: your app mints a short-lived signed hand-off token for the logged-in
user and hands them to the CIMP reporter form — the secret never leaves your
server.

- **Core** (`CimpHandoff`) — zero dependencies, works in any Java framework
  (plain servlets, Micronaut, Quarkus, …).
- **Spring Boot auto-configuration** — add the dependency, set three
  properties, define one `CimpUserResolver` bean → `GET /support/handoff`
  exists. No other code.

Requires Java 17+; the auto-configuration targets Spring Boot 3.x.

## Install (JitPack)

```xml
<repositories>
  <repository>
    <id>jitpack.io</id>
    <url>https://jitpack.io</url>
  </repository>
</repositories>

<dependency>
  <groupId>com.github.ragnarokansh</groupId>
  <artifactId>cimp-connect</artifactId>
  <version>v0.4.0</version>
</dependency>
```

Gradle: `implementation 'com.github.ragnarokansh:cimp-connect:v0.4.0'` with
`maven { url 'https://jitpack.io' }` in repositories.

## Spring Boot setup

`application.properties` (get the key/secret from CIMP → Admin → Platforms →
Rotate, or run `npx cimp-connect init` anywhere and copy the values):

```properties
cimp.platform-key=my-app
cimp.handoff-secret=<rotated secret>
cimp.support-url=https://support.example.com
```

Define the one project-specific piece — how to read the current user:

```java
@Bean
CimpUserResolver cimpUserResolver(UserRepository users) {
    return request -> {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;   // → 401
        User u = users.findByUsername(auth.getName());
        return new HandoffUser(u.getId().toString(), u.getFullName(), u.getEmail());
    };
}
```

That's it — `GET /support/handoff` is live. Protect it in your security config
like any authenticated route. Frontend: point the npm package's button (or any
link) at it, exactly as with the Node backends.

Like the Node adapters, the endpoint **content-negotiates**: a browser link
click (`Accept: text/html`) gets a 302 redirect to CIMP; clients sending
`Accept: application/json` (or `?format=json`) get `{"url": ...}` back to
`window.open` themselves — use that when your frontend keeps the JWT in an
Authorization header instead of a cookie.

Optional properties: `cimp.route` (default `/support/handoff`),
`cimp.reporter-path` (default `/reporter/new`), `cimp.expires-in` (default
`5m`; CIMP hard-caps token age at 15 minutes).

## Core only (no Spring)

```java
import io.github.ragnarokansh.cimpconnect.CimpHandoff;
import io.github.ragnarokansh.cimpconnect.HandoffUser;

String token = CimpHandoff.mintHandoffToken(
    platformKey, secret, new HandoffUser(user.getId(), user.getName(), user.getEmail()));
String url = CimpHandoff.buildHandoffUrl(supportUrl, token);
// redirect the user to `url`, or return it as JSON for the frontend to open
```

## Token contract (for other ports)

HS256 JWT, claims `platformKey`, `portalUserId`, `name`, `email`, `iat`,
`exp` (required — CIMP rejects tokens without an expiry and caps age at 15
minutes server-side). Delivered as `<CIMP>/reporter/new?handoff=<token>`.
