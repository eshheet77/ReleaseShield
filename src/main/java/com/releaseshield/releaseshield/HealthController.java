package com.releaseshield.releaseshield;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/health")
    public String health() {
        return "ReleaseShield is healthy";
    }

    @GetMapping("/version")
    public String version() {
        return "ReleaseShield v1";
    }
}