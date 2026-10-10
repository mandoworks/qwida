import { describe, expect, it } from "vitest";
import { deviceLabel, personName, whoFrom } from "./audit";

describe("audit: who tapped", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9)", "Android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)", "Mac"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Windows"],
    ["curl/8.7.1", null],
    [null, null],
  ])("%s is %s", (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });

  it("names the people of a synthetic household and nobody else", () => {
    expect(personName("demo-carmen", "caregiver")).toBe("Marisol Rivera");
    expect(personName("demo-carmen", "patient")).toBe("Doña Carmen");
    expect(personName("jurado", "caregiver")).toBeNull();
  });

  it("reads the device from the request and the name from the role", () => {
    const request = new Request("http://x", { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" } });
    expect(whoFrom(request, "demo-carmen", "caregiver")).toEqual({ name: "Marisol Rivera", device: "iPhone" });
    expect(whoFrom(request, "demo-carmen", undefined)).toEqual({ name: null, device: "iPhone" });
  });
});
