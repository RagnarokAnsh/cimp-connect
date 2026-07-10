package io.github.ragnarokansh.cimpconnect.spring;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * Auto-configuration: add the dependency, set the three {@code cimp.*}
 * properties, define one {@link CimpUserResolver} bean — and
 * {@code GET /support/handoff} exists. No other code.
 */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnBean(CimpUserResolver.class)
@EnableConfigurationProperties(CimpConnectProperties.class)
public class CimpConnectAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public CimpSupportController cimpSupportController(
            CimpConnectProperties props, CimpUserResolver userResolver) {
        return new CimpSupportController(props, userResolver);
    }
}
