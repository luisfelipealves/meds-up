package com.medsup.wear;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public final class FoundationTest {
    @Test
    public void identifiesWearSurface() {
        assertEquals("wear", Foundation.surface());
    }
}
