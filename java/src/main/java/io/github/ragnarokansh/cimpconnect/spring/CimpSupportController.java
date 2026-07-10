package io.github.ragnarokansh.cimpconnect.spring;

import io.github.ragnarokansh.cimpconnect.CimpHandoff;
import io.github.ragnarokansh.cimpconnect.HandoffUser;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET {@code ${cimp.route:/support/handoff}} — mints a hand-off token for the
 * current user and hands them to CIMP.
 *
 * <p>Content-negotiates like the Node adapters: a browser link click
 * ({@code Accept: text/html}) gets a 302 redirect; clients sending
 * {@code Accept: application/json} (or {@code ?format=json}) — e.g. an
 * Angular HttpClient whose interceptor carries the JWT — get
 * {@code {"url": ...}} back to open themselves.</p>
 */
@RestController
public class CimpSupportController {

    private final CimpConnectProperties props;
    private final CimpUserResolver userResolver;

    public CimpSupportController(CimpConnectProperties props, CimpUserResolver userResolver) {
        this.props = props;
        this.userResolver = userResolver;
    }

    @GetMapping("${cimp.route:/support/handoff}")
    public ResponseEntity<?> handoff(HttpServletRequest request) {
        if (!props.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message",
                            "cimp-connect is not configured — set cimp.platform-key, cimp.handoff-secret and cimp.support-url."));
        }

        HandoffUser user = userResolver.resolve(request);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "No authenticated user for this request."));
        }

        String token = CimpHandoff.mintHandoffToken(
                props.getPlatformKey(), props.getHandoffSecret(), user, props.getExpiresIn());
        String url = CimpHandoff.buildHandoffUrl(props.getSupportUrl(), token, props.getReporterPath());

        if (wantsJson(request)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("url", url));
        }
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    private static boolean wantsJson(HttpServletRequest request) {
        if ("json".equals(request.getParameter("format"))) return true;
        String accept = request.getHeader("Accept");
        return accept != null
                && accept.contains(MediaType.APPLICATION_JSON_VALUE)
                && !accept.contains(MediaType.TEXT_HTML_VALUE);
    }
}
