import { describe, it, expect } from "vitest";
import { CreditBalance } from "./CreditBalance.js";

describe("CreditBalance", () => {
  describe("initial state", () => {
    it("FREE plan starts with 10 credits", () => {
      const balance = CreditBalance.initial("FREE");
      expect(balance.available).toBe(10);
      expect(balance.reserved).toBe(0);
      expect(balance.totalUsed).toBe(0);
      expect(balance.plan).toBe("FREE");
    });

    it("PRO plan starts with 0 available (purchased separately)", () => {
      const balance = CreditBalance.initial("PRO");
      expect(balance.available).toBe(0);
    });
  });

  describe("create validation", () => {
    it("throws if available is negative", () => {
      expect(() =>
        CreditBalance.create({ available: -1, reserved: 0, totalUsed: 0, plan: "FREE" })
      ).toThrow("Available credits cannot be negative");
    });

    it("throws if reserved is negative", () => {
      expect(() =>
        CreditBalance.create({ available: 0, reserved: -1, totalUsed: 0, plan: "FREE" })
      ).toThrow("Reserved credits cannot be negative");
    });

    it("throws if totalUsed is negative", () => {
      expect(() =>
        CreditBalance.create({ available: 0, reserved: 0, totalUsed: -1, plan: "FREE" })
      ).toThrow("Total used credits cannot be negative");
    });
  });

  describe("reserve", () => {
    it("decreases available and increases reserved", () => {
      const balance = CreditBalance.initial("FREE");
      const next = balance.reserve(3);
      expect(next.available).toBe(7);
      expect(next.reserved).toBe(3);
    });

    it("throws if amount exceeds available", () => {
      const balance = CreditBalance.initial("FREE");
      expect(() => balance.reserve(11)).toThrow("Insufficient credits");
    });

    it("throws if amount is zero", () => {
      const balance = CreditBalance.initial("FREE");
      expect(() => balance.reserve(0)).toThrow("Reserve amount must be positive");
    });

    it("throws if amount is negative", () => {
      const balance = CreditBalance.initial("FREE");
      expect(() => balance.reserve(-1)).toThrow("Reserve amount must be positive");
    });

    it("canReserve returns true when sufficient", () => {
      const balance = CreditBalance.initial("FREE");
      expect(balance.canReserve(5)).toBe(true);
    });

    it("canReserve returns false when insufficient", () => {
      const balance = CreditBalance.initial("FREE");
      expect(balance.canReserve(11)).toBe(false);
    });

    it("canReserve returns false for zero", () => {
      const balance = CreditBalance.initial("FREE");
      expect(balance.canReserve(0)).toBe(false);
    });
  });

  describe("confirm", () => {
    it("decreases reserved and increases totalUsed", () => {
      const balance = CreditBalance.initial("FREE").reserve(3);
      const confirmed = balance.confirm(3);
      expect(confirmed.reserved).toBe(0);
      expect(confirmed.totalUsed).toBe(3);
      expect(confirmed.available).toBe(7);
    });

    it("throws if confirming more than reserved", () => {
      const balance = CreditBalance.initial("FREE").reserve(3);
      expect(() => balance.confirm(5)).toThrow("Cannot confirm more than reserved");
    });

    it("throws if amount is zero", () => {
      const balance = CreditBalance.initial("FREE").reserve(3);
      expect(() => balance.confirm(0)).toThrow("Confirm amount must be positive");
    });
  });

  describe("rollback", () => {
    it("restores reserved credits to available", () => {
      const balance = CreditBalance.initial("FREE").reserve(3);
      const rolled = balance.rollback(3);
      expect(rolled.available).toBe(10);
      expect(rolled.reserved).toBe(0);
      expect(rolled.totalUsed).toBe(0);
    });

    it("throws if rolling back more than reserved", () => {
      const balance = CreditBalance.initial("FREE").reserve(3);
      expect(() => balance.rollback(5)).toThrow("Cannot rollback more than reserved");
    });

    it("throws if amount is zero", () => {
      const balance = CreditBalance.initial("FREE").reserve(3);
      expect(() => balance.rollback(0)).toThrow("Rollback amount must be positive");
    });
  });

  describe("immutability", () => {
    it("does not mutate original on reserve", () => {
      const original = CreditBalance.initial("FREE");
      original.reserve(3);
      expect(original.available).toBe(10);
      expect(original.reserved).toBe(0);
    });

    it("does not mutate original on confirm", () => {
      const reserved = CreditBalance.initial("FREE").reserve(3);
      reserved.confirm(3);
      expect(reserved.reserved).toBe(3);
    });
  });

  describe("plan limits", () => {
    it("FREE plan has limit of 10", () => {
      expect(CreditBalance.initial("FREE").monthlyLimit).toBe(10);
    });

    it("PRO plan has limit of 100", () => {
      expect(CreditBalance.initial("PRO").monthlyLimit).toBe(100);
    });

    it("ENTERPRISE plan has infinite limit", () => {
      expect(CreditBalance.initial("ENTERPRISE").monthlyLimit).toBe(Infinity);
    });
  });
});
