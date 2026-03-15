import { describe, it, expect } from "vitest";
import { Email } from "./Email.js";

describe("Email", () => {
  describe("valid emails", () => {
    it("accepts a standard email", () => {
      const email = Email.create("user@example.com");
      expect(email.value).toBe("user@example.com");
    });

    it("normalizes to lowercase", () => {
      const email = Email.create("User@EXAMPLE.COM");
      expect(email.value).toBe("user@example.com");
    });

    it("trims whitespace", () => {
      const email = Email.create("  user@example.com  ");
      expect(email.value).toBe("user@example.com");
    });

    it("accepts email with subdomain", () => {
      const email = Email.create("user@mail.example.co.uk");
      expect(email.value).toBe("user@mail.example.co.uk");
    });

    it("accepts email with plus addressing", () => {
      const email = Email.create("user+tag@example.com");
      expect(email.value).toBe("user+tag@example.com");
    });
  });

  describe("invalid emails", () => {
    it("rejects empty string", () => {
      expect(() => Email.create("")).toThrow("Email cannot be empty");
    });

    it("rejects whitespace only", () => {
      expect(() => Email.create("   ")).toThrow("Email cannot be empty");
    });

    it("rejects missing @", () => {
      expect(() => Email.create("userexample.com")).toThrow("Invalid email format");
    });

    it("rejects missing domain", () => {
      expect(() => Email.create("user@")).toThrow("Invalid email format");
    });

    it("rejects missing local part", () => {
      expect(() => Email.create("@example.com")).toThrow("Invalid email format");
    });

    it("rejects email exceeding 254 characters", () => {
      const longEmail = "a".repeat(244) + "@example.com";
      expect(() => Email.create(longEmail)).toThrow(
        "Email exceeds maximum length of 254 characters"
      );
    });
  });

  describe("equals", () => {
    it("returns true for identical emails", () => {
      const a = Email.create("user@example.com");
      const b = Email.create("user@example.com");
      expect(a.equals(b)).toBe(true);
    });

    it("returns true after normalization", () => {
      const a = Email.create("User@Example.COM");
      const b = Email.create("user@example.com");
      expect(a.equals(b)).toBe(true);
    });

    it("returns false for different emails", () => {
      const a = Email.create("user@example.com");
      const b = Email.create("other@example.com");
      expect(a.equals(b)).toBe(false);
    });
  });
});
