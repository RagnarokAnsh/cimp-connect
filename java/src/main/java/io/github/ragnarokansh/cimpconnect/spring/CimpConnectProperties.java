package io.github.ragnarokansh.cimpconnect.spring;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds the {@code cimp.*} properties. Only three are required:
 *
 * <pre>
 * cimp.platform-key=his-project
 * cimp.handoff-secret=&lt;from CIMP → Admin → Platforms → Rotate&gt;
 * cimp.support-url=https://support.example.com
 * </pre>
 */
@ConfigurationProperties(prefix = "cimp")
public class CimpConnectProperties {

    /** Platform key registered in CIMP (Admin → Platforms). */
    private String platformKey;

    /** Per-platform hand-off signing secret from CIMP. Server-side only. */
    private String handoffSecret;

    /** CIMP base URL, e.g. https://support.example.com */
    private String supportUrl;

    /** Route the handoff endpoint is served on. */
    private String route = "/support/handoff";

    /** Reporter path on CIMP. */
    private String reporterPath = "/reporter/new";

    /** Token lifetime. Keep it short (CIMP hard-caps at 15 minutes). */
    private Duration expiresIn = Duration.ofMinutes(5);

    public String getPlatformKey() { return platformKey; }
    public void setPlatformKey(String platformKey) { this.platformKey = platformKey; }
    public String getHandoffSecret() { return handoffSecret; }
    public void setHandoffSecret(String handoffSecret) { this.handoffSecret = handoffSecret; }
    public String getSupportUrl() { return supportUrl; }
    public void setSupportUrl(String supportUrl) { this.supportUrl = supportUrl; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public String getReporterPath() { return reporterPath; }
    public void setReporterPath(String reporterPath) { this.reporterPath = reporterPath; }
    public Duration getExpiresIn() { return expiresIn; }
    public void setExpiresIn(Duration expiresIn) { this.expiresIn = expiresIn; }

    boolean isConfigured() {
        return notBlank(platformKey) && notBlank(handoffSecret) && notBlank(supportUrl);
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
