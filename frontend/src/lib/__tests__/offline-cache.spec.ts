import { featuresCacheKey, CACHE_KEYS } from "../offline-cache";

describe("offline-cache", () => {
  describe("featuresCacheKey", () => {
    it("returns features:businessId format", () => {
      expect(featuresCacheKey("biz-123")).toBe("features:biz-123");
    });

    it("handles empty businessId", () => {
      expect(featuresCacheKey("")).toBe("features:");
    });
  });

  describe("CACHE_KEYS", () => {
    it("has PREFERENCES and FEATURES", () => {
      expect(CACHE_KEYS.PREFERENCES).toBe("preferences");
      expect(CACHE_KEYS.FEATURES).toBe("features");
    });
  });
});
