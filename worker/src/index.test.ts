import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAllowedUrl, handleRequest } from "./index";

describe("isAllowedUrl", () => {
  it("allows modulargrid.net rack URLs without www", () => {
    expect(isAllowedUrl("https://modulargrid.net/e/racks/view/12345")).toBe(
      true
    );
  });

  it("allows modulargrid.net rack URLs with www", () => {
    expect(
      isAllowedUrl("https://www.modulargrid.net/e/racks/view/99999")
    ).toBe(true);
  });

  it("rejects non-modulargrid URLs", () => {
    expect(isAllowedUrl("https://example.com/e/racks/view/123")).toBe(false);
  });

  it("rejects modulargrid module pages (not rack view)", () => {
    expect(isAllowedUrl("https://modulargrid.net/e/modules/view/123")).toBe(
      false
    );
  });

  it("rejects empty strings", () => {
    expect(isAllowedUrl("")).toBe(false);
  });

  it("rejects URLs with extra path segments", () => {
    expect(
      isAllowedUrl("https://modulargrid.net/e/racks/view/123/extra")
    ).toBe(false);
  });

  it("rejects HTTP (non-HTTPS) modulargrid URLs", () => {
    expect(isAllowedUrl("http://modulargrid.net/e/racks/view/123")).toBe(false);
  });
});

describe("handleRequest", () => {
  const allowedOrigin = "https://rackcut.app";

  function makeRequest(url: string, method = "GET"): Request {
    return new Request(url, { method });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for missing url param", async () => {
    const request = makeRequest("https://worker.example.com/");
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for non-modulargrid URL", async () => {
    const request = makeRequest(
      "https://worker.example.com/?url=https://evil.com/page"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("sets CORS headers for allowed origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>rack</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    );

    const request = makeRequest(
      "https://worker.example.com/?url=https://modulargrid.net/e/racks/view/123"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      allowedOrigin
    );
  });

  it("proxies HTML content on success", async () => {
    const htmlContent = "<html><body>My Rack</body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    );

    const request = makeRequest(
      "https://worker.example.com/?url=https://modulargrid.net/e/racks/view/456"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    const text = await response.text();
    expect(text).toBe(htmlContent);
  });

  it("proxies error status from modulargrid (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Not Found", {
          status: 404,
        })
      )
    );

    const request = makeRequest(
      "https://worker.example.com/?url=https://modulargrid.net/e/racks/view/999"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(404);
  });

  it("returns 413 for oversized responses (mock 3MB response)", async () => {
    const oversizedBody = new Uint8Array(3 * 1024 * 1024).fill(65); // 3MB of 'A'
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(oversizedBody, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    );

    const request = makeRequest(
      "https://worker.example.com/?url=https://modulargrid.net/e/racks/view/789"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("handles CORS preflight (OPTIONS → 204 with CORS headers)", async () => {
    const request = makeRequest(
      "https://worker.example.com/?url=https://modulargrid.net/e/racks/view/123",
      "OPTIONS"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      allowedOrigin
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "GET"
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "OPTIONS"
    );
  });

  it("returns 502 on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const request = makeRequest(
      "https://worker.example.com/?url=https://modulargrid.net/e/racks/view/123"
    );
    const response = await handleRequest(request, allowedOrigin);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});
