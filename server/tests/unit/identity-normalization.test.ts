import { normalizeEmail, normalizePhone, identifierClauses } from "../../src/services/auth.service";

describe("normalizeEmail", () => {
  it("trims and lowercases so one address is one account", () => {
    expect(normalizeEmail("  Deepika@Example.COM ")).toBe("deepika@example.com");
  });
});

describe("normalizePhone", () => {
  it("keeps only the digits of a number typed with spacing", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
    expect(normalizePhone("98765-43210")).toBe("9876543210");
    expect(normalizePhone("(98765) 43210")).toBe("9876543210");
  });

  it("drops an Indian country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("919876543210")).toBe("9876543210");
  });

  it("leaves a plain ten-digit number untouched", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210");
  });
});

describe("identifierClauses", () => {
  it("matches an email case-insensitively and adds no phone clause", () => {
    expect(identifierClauses("Deepika@Example.com")).toEqual([
      { email: { equals: "deepika@example.com", mode: "insensitive" } }
    ]);
  });

  it("matches a phone in whichever shape it was typed", () => {
    expect(identifierClauses("+91 98765 43210")).toEqual([
      { email: { equals: "+91 98765 43210", mode: "insensitive" } },
      { phone: "9876543210" }
    ]);
  });
});
