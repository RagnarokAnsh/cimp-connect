package io.github.ragnarokansh.cimpconnect;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Framework-agnostic core: mint a short-lived HS256 hand-off token and build
 * the CIMP reporter URL. Mirrors the npm package's {@code mintHandoffToken} /
 * {@code buildHandoffUrl} and produces tokens CIMP's HandoffGuard accepts:
 * claims {@code platformKey}, {@code portalUserId}, {@code name},
 * {@code email}, plus {@code iat}/{@code exp} (exp is REQUIRED by CIMP; the
 * server also caps total age at 15 minutes).
 *
 * <p>Zero dependencies — the JWT is assembled by hand (HmacSHA256 +
 * base64url), so this class works in any Java framework. Sign ONLY on the
 * server; never expose the secret to a browser.</p>
 */
public final class CimpHandoff {

    /** Default token lifetime — keep it short. */
    public static final Duration DEFAULT_EXPIRES_IN = Duration.ofMinutes(5);

    private CimpHandoff() {}

    /** Mint with the default 5-minute lifetime. */
    public static String mintHandoffToken(String platformKey, String secret, HandoffUser user) {
        return mintHandoffToken(platformKey, secret, user, DEFAULT_EXPIRES_IN);
    }

    /**
     * Mint a hand-off token. CIMP reads the (unverified) {@code platformKey},
     * loads that platform's secret, and verifies the HS256 signature + expiry
     * against it — the signature is the entire trust anchor.
     */
    public static String mintHandoffToken(String platformKey, String secret, HandoffUser user, Duration expiresIn) {
        if (platformKey == null || platformKey.isBlank()) throw new IllegalArgumentException("platformKey is required");
        if (secret == null || secret.isBlank()) throw new IllegalArgumentException("secret is required");
        if (user == null) throw new IllegalArgumentException("user is required");

        long iat = Instant.now().getEpochSecond();
        long exp = iat + (expiresIn == null ? DEFAULT_EXPIRES_IN : expiresIn).getSeconds();

        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payloadJson = "{"
                + "\"platformKey\":" + jsonString(platformKey) + ","
                + "\"portalUserId\":" + jsonString(user.id()) + ","
                + "\"name\":" + jsonString(user.name()) + ","
                + "\"email\":" + jsonString(user.email()) + ","
                + "\"iat\":" + iat + ","
                + "\"exp\":" + exp
                + "}";
        String payload = base64Url(payloadJson.getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + payload;
        return signingInput + "." + base64Url(hmacSha256(secret, signingInput));
    }

    /** Build the reporter URL with the default {@code /reporter/new} path. */
    public static String buildHandoffUrl(String baseUrl, String token) {
        return buildHandoffUrl(baseUrl, token, "/reporter/new");
    }

    /**
     * Build the URL to send the user to — delivers the token exactly the way
     * CIMP's reporter surface expects ({@code ?handoff=}).
     */
    public static String buildHandoffUrl(String baseUrl, String token, String reporterPath) {
        String base = baseUrl.replaceAll("/+$", "");
        String path = (reporterPath == null || reporterPath.isBlank()) ? "/reporter/new" : reporterPath;
        return base + path + "?handoff=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    private static byte[] hmacSha256(String secret, String input) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Minimal JSON string encoder (RFC 8259) — enough for identity claims. */
    private static String jsonString(String value) {
        StringBuilder sb = new StringBuilder(value.length() + 2).append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }
}
