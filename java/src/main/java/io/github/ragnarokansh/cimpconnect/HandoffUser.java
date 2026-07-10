package io.github.ragnarokansh.cimpconnect;

/**
 * The reporter identity CIMP needs in every hand-off token. {@code id} is the
 * stable id of the user <em>in your system</em> (becomes {@code portalUserId}
 * in CIMP).
 */
public record HandoffUser(String id, String name, String email) {
    public HandoffUser {
        if (id == null || id.isBlank()) throw new IllegalArgumentException("HandoffUser.id is required");
        if (name == null || name.isBlank()) throw new IllegalArgumentException("HandoffUser.name is required");
        if (email == null || email.isBlank()) throw new IllegalArgumentException("HandoffUser.email is required");
    }
}
