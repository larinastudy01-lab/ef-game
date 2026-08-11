import { isAllowedRole } from "./ProtectedRoute";

describe("isAllowedRole", () => {
  const clinicianRoles = ["clinician", "medical", "doctor"];

  test("accepts configured roles without depending on casing or whitespace", () => {
    expect(isAllowedRole(" Clinician ", clinicianRoles)).toBe(true);
    expect(isAllowedRole("DOCTOR", clinicianRoles)).toBe(true);
  });

  test("rejects missing and non-clinical roles", () => {
    expect(isAllowedRole("guardian", clinicianRoles)).toBe(false);
    expect(isAllowedRole(null, clinicianRoles)).toBe(false);
  });

  test("allows any authenticated role when no role restriction is configured", () => {
    expect(isAllowedRole("guardian", [])).toBe(true);
  });
});
