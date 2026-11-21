import { CLINICAL_API_STORAGE_KEY, clinicalApiUrl, normalizeClinicalApiBase, saveClinicalApiBase } from "./clinicalApi";
beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/"); });
test("default API stays same-origin; only HTTPS or local HTTP origins are accepted", () => {
  expect(clinicalApiUrl("/api/clinical-assistant")).toBe("/api/clinical-assistant");
  expect(normalizeClinicalApiBase("https://demo.trycloudflare.com/")).toBe("https://demo.trycloudflare.com");
  expect(normalizeClinicalApiBase("http://localhost:3001")).toBe("http://localhost:3001");
  for (const value of ["http://remote.example", "javascript:alert(1)", "https://user:pass@remote.example", "https://remote.example/api", "https://remote.example/?token=x"]) expect(() => normalizeClinicalApiBase(value)).toThrow();
});
test("a shared endpoint never redirects a login token until explicitly confirmed", () => {
  window.history.replaceState({}, "", "/?aiEndpoint=https%3A%2F%2Fdemo.trycloudflare.com");
  expect(() => clinicalApiUrl("/api/clinical-assistant")).toThrow(/確認/);
  expect(sessionStorage.getItem(CLINICAL_API_STORAGE_KEY)).toBeNull();
  saveClinicalApiBase("https://demo.trycloudflare.com");
  expect(clinicalApiUrl("/api/clinical-assistant")).toBe("https://demo.trycloudflare.com/api/clinical-assistant");
  expect(clinicalApiUrl("/api/assistant-email")).toBe("https://demo.trycloudflare.com/api/assistant-email");
  saveClinicalApiBase("");
  expect(clinicalApiUrl("/api/clinical-assistant")).toBe("/api/clinical-assistant");
});
test("reset restores a deployment's configured default endpoint", () => {
  const previous = process.env.REACT_APP_CLINICAL_API_BASE_URL;
  try {
    process.env.REACT_APP_CLINICAL_API_BASE_URL = "https://default.example";
    saveClinicalApiBase("https://temporary.trycloudflare.com");
    saveClinicalApiBase("");
    expect(clinicalApiUrl("/api/clinical-assistant")).toBe("https://default.example/api/clinical-assistant");
  } finally {
    if (previous === undefined) delete process.env.REACT_APP_CLINICAL_API_BASE_URL;
    else process.env.REACT_APP_CLINICAL_API_BASE_URL = previous;
  }
});
