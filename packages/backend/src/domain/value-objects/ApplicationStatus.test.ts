import { describe, it, expect } from "vitest";
import { ApplicationStatus } from "./ApplicationStatus.js";

describe("ApplicationStatus", () => {
  describe("initial state", () => {
    it("starts as queued", () => {
      const status = ApplicationStatus.initial();
      expect(status.value).toBe("queued");
    });
  });

  describe("valid transitions", () => {
    it("queued → applying", () => {
      const status = ApplicationStatus.initial();
      const next = status.transitionTo("applying");
      expect(next.value).toBe("applying");
    });

    it("applying → submitted", () => {
      const status = ApplicationStatus.create("applying");
      const next = status.transitionTo("submitted");
      expect(next.value).toBe("submitted");
    });

    it("applying → failed", () => {
      const status = ApplicationStatus.create("applying");
      const next = status.transitionTo("failed");
      expect(next.value).toBe("failed");
    });

    it("failed → retrying", () => {
      const status = ApplicationStatus.create("failed");
      const next = status.transitionTo("retrying");
      expect(next.value).toBe("retrying");
    });

    it("retrying → applying", () => {
      const status = ApplicationStatus.create("retrying");
      const next = status.transitionTo("applying");
      expect(next.value).toBe("applying");
    });

    it("retrying → exhausted", () => {
      const status = ApplicationStatus.create("retrying");
      const next = status.transitionTo("exhausted");
      expect(next.value).toBe("exhausted");
    });
  });

  describe("invalid transitions", () => {
    it("throws on queued → submitted (skipping steps)", () => {
      const status = ApplicationStatus.initial();
      expect(() => status.transitionTo("submitted")).toThrow(
        "Invalid status transition: queued → submitted"
      );
    });

    it("throws on submitted → applying (terminal state)", () => {
      const status = ApplicationStatus.create("submitted");
      expect(() => status.transitionTo("applying")).toThrow(
        "Invalid status transition: submitted → applying"
      );
    });

    it("throws on exhausted → applying (terminal state)", () => {
      const status = ApplicationStatus.create("exhausted");
      expect(() => status.transitionTo("applying")).toThrow(
        "Invalid status transition: exhausted → applying"
      );
    });

    it("throws on applying → queued (backward transition)", () => {
      const status = ApplicationStatus.create("applying");
      expect(() => status.transitionTo("queued")).toThrow(
        "Invalid status transition: applying → queued"
      );
    });

    it("throws on failed → submitted (invalid)", () => {
      const status = ApplicationStatus.create("failed");
      expect(() => status.transitionTo("submitted")).toThrow(
        "Invalid status transition: failed → submitted"
      );
    });
  });

  describe("canTransitionTo", () => {
    it("returns true for valid transition", () => {
      const status = ApplicationStatus.initial();
      expect(status.canTransitionTo("applying")).toBe(true);
    });

    it("returns false for invalid transition", () => {
      const status = ApplicationStatus.initial();
      expect(status.canTransitionTo("submitted")).toBe(false);
    });
  });

  describe("isTerminal", () => {
    it("submitted is terminal", () => {
      expect(ApplicationStatus.create("submitted").isTerminal()).toBe(true);
    });

    it("exhausted is terminal", () => {
      expect(ApplicationStatus.create("exhausted").isTerminal()).toBe(true);
    });

    it("queued is not terminal", () => {
      expect(ApplicationStatus.initial().isTerminal()).toBe(false);
    });

    it("applying is not terminal", () => {
      expect(ApplicationStatus.create("applying").isTerminal()).toBe(false);
    });

    it("failed is not terminal", () => {
      expect(ApplicationStatus.create("failed").isTerminal()).toBe(false);
    });

    it("retrying is not terminal", () => {
      expect(ApplicationStatus.create("retrying").isTerminal()).toBe(false);
    });
  });

  describe("equals", () => {
    it("returns true for same status", () => {
      const a = ApplicationStatus.initial();
      const b = ApplicationStatus.initial();
      expect(a.equals(b)).toBe(true);
    });

    it("returns false for different status", () => {
      const a = ApplicationStatus.initial();
      const b = ApplicationStatus.create("applying");
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("immutability", () => {
    it("does not mutate original on transition", () => {
      const original = ApplicationStatus.initial();
      original.transitionTo("applying");
      expect(original.value).toBe("queued");
    });
  });
});
