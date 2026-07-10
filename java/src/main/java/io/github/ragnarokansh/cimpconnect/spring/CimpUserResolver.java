package io.github.ragnarokansh.cimpconnect.spring;

import io.github.ragnarokansh.cimpconnect.HandoffUser;
import jakarta.servlet.http.HttpServletRequest;

/**
 * The one project-specific piece: how to read the currently authenticated
 * user from a request. Define exactly one bean of this type and the handoff
 * endpoint auto-registers:
 *
 * <pre>
 * &#64;Bean
 * CimpUserResolver cimpUserResolver(UserService users) {
 *     return request -&gt; {
 *         var principal = SecurityContextHolder.getContext().getAuthentication();
 *         if (principal == null || !principal.isAuthenticated()) return null;
 *         var u = users.findByUsername(principal.getName());
 *         return new HandoffUser(u.getId().toString(), u.getFullName(), u.getEmail());
 *     };
 * }
 * </pre>
 *
 * Return {@code null} when there is no authenticated user — the endpoint
 * answers 401. (Still protect the route in your security config; this is the
 * second line of defense, not the first.)
 */
@FunctionalInterface
public interface CimpUserResolver {
    HandoffUser resolve(HttpServletRequest request);
}
