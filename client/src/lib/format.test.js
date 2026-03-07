import { expect, test, describe } from "bun:test";
import { formatNumber } from "./format";

describe("formatNumber", () => {
  test("formats integers correctly", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(0)).toBe("0");
  });

  test("formats floating point numbers with default fractionDigits (1)", () => {
    expect(formatNumber(1234.567)).toBe("1,234.6");
    expect(formatNumber(0.123)).toBe("0.1");
  });

  test("formats numbers with custom fractionDigits", () => {
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
    expect(formatNumber(1234.567, 0)).toBe("1,235");
  });

  test("formats number strings correctly", () => {
    expect(formatNumber("1234.567")).toBe("1,234.6");
  });

  test("returns '-' for invalid inputs", () => {
    expect(formatNumber(null)).toBe("-");
    expect(formatNumber(undefined)).toBe("-");
    expect(formatNumber(NaN)).toBe("-");
    expect(formatNumber("not a number")).toBe("-");
  });

  test("handles zero correctly", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber("0")).toBe("0");
  });

  test("handles negative numbers", () => {
    expect(formatNumber(-1234.567)).toBe("-1,234.6");
  });
});
