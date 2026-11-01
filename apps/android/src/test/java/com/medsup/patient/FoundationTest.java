package com.medsup.patient;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public final class FoundationTest {
    @Test
    public void identifiesAndroidSurface() {
        assertEquals("android", Foundation.surface());
    }
}
