import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import ModularGridDialog from "./ModularGridDialog";
import type { Format } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_URL = "https://modulargrid.net/e/racks/view/12345";
const VALID_URL_WWW = "https://www.modulargrid.net/e/racks/view/99";

function makeHtml(blankHp = 4): string {
  const json = JSON.stringify({
    rack: {
      Rack: { rows: "1", te: "84", rows1u: [], rows1usystem: null },
      Module: [{ name: "Plaits", te: String(84 - blankHp), is_1u: false, ModulesRack: { row: "1" } }],
    },
  });
  return `<html><body><script type="application/json" data-mg-json="rtd">${json}</script></body></html>`;
}

// ---------------------------------------------------------------------------
// Mock import.meta.env
// ---------------------------------------------------------------------------

const WORKER_URL = "https://worker.example.com";

vi.stubEnv("VITE_WORKER_URL", WORKER_URL);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModularGridDialog", () => {
  const onImport = vi.fn<(blanks: { hp: number; format: Format }[]) => void>();

  beforeEach(() => {
    onImport.mockClear();
    vi.restoreAllMocks();
    // Re-stub after restoreAllMocks
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // 1. Renders trigger button that opens dialog
  // -------------------------------------------------------------------------
  test("renders import button that opens dialog", async () => {
    const user = userEvent.setup();
    render(<ModularGridDialog onImport={onImport} />);

    const trigger = screen.getByRole("button", {
      name: /import from modulargrid/i,
    });
    expect(trigger).toBeInTheDocument();

    // Dialog content should not be visible yet
    expect(screen.queryByLabelText(/rack url/i)).not.toBeInTheDocument();

    // Open the dialog
    await user.click(trigger);

    // Dialog should now show the URL input
    expect(screen.getByLabelText(/rack url/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Validates URL format — does NOT call fetch for invalid URLs
  // -------------------------------------------------------------------------
  test("validates URL format before fetching (shows error, does not call fetch)", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));

    const urlInput = screen.getByLabelText(/rack url/i);
    await user.type(urlInput, "https://example.com/not-a-modulargrid-url");

    const importButton = screen.getByRole("button", { name: /^import$/i });
    await user.click(importButton);

    // Error message should be shown
    expect(screen.getByText(/invalid.*url/i)).toBeInTheDocument();

    // fetch must NOT have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Shows loading state while fetching
  // -------------------------------------------------------------------------
  test("shows loading state while fetching", async () => {
    const user = userEvent.setup();

    // Never-resolving promise simulates in-flight request
    const mockFetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", mockFetch);

    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));

    const urlInput = screen.getByLabelText(/rack url/i);
    await user.type(urlInput, VALID_URL);

    const importButton = screen.getByRole("button", { name: /^import$/i });
    await user.click(importButton);

    // Import button should now show loading text
    expect(
      screen.getByRole("button", { name: /loading/i })
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Shows error when worker is unreachable (fetch rejects)
  // -------------------------------------------------------------------------
  test("shows error when worker is unreachable", async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn(() => Promise.reject(new Error("Network Error")));
    vi.stubGlobal("fetch", mockFetch);

    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));

    const urlInput = screen.getByLabelText(/rack url/i);
    await user.type(urlInput, VALID_URL);

    await user.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error|unreachable|failed to fetch/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Successful fetch: shows rows and "Add Selected" button
  // -------------------------------------------------------------------------
  test("shows rack rows after successful fetch", async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn(() =>
      Promise.resolve(
        new Response(makeHtml(4), { status: 200 })
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));

    await user.type(screen.getByLabelText(/rack url/i), VALID_URL);
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add selected/i })).toBeInTheDocument();
    });

    // Should show blank HP info
    expect(screen.getByText(/4.*blank|blank.*4/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Accepts www. variant of the URL
  // -------------------------------------------------------------------------
  test("accepts www. variant of modulargrid URL", async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn(() =>
      Promise.resolve(new Response(makeHtml(8), { status: 200 }))
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    await user.type(screen.getByLabelText(/rack url/i), VALID_URL_WWW);
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add selected/i })).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(VALID_URL_WWW))
    );
  });

  // -------------------------------------------------------------------------
  // 7. Calls onImport with selected blanks and closes dialog
  // -------------------------------------------------------------------------
  test("calls onImport with selected blanks when Add Selected is clicked", async () => {
    const user = userEvent.setup();

    const mockFetch = vi.fn(() =>
      Promise.resolve(new Response(makeHtml(4), { status: 200 }))
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    await user.type(screen.getByLabelText(/rack url/i), VALID_URL);
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add selected/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add selected/i }));

    expect(onImport).toHaveBeenCalledOnce();
    const [blanks] = onImport.mock.calls[0];
    expect(blanks).toHaveLength(1);
    expect(blanks[0].hp).toBe(4);
    expect(blanks[0].format).toBe("3u");

    // Dialog should be closed
    expect(screen.queryByLabelText(/rack url/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 8. Shows "not configured" when VITE_WORKER_URL is empty
  // -------------------------------------------------------------------------
  test("shows not configured error when VITE_WORKER_URL is empty", async () => {
    vi.stubEnv("VITE_WORKER_URL", "");

    const user = userEvent.setup();
    render(<ModularGridDialog onImport={onImport} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    await user.type(screen.getByLabelText(/rack url/i), VALID_URL);
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });

    // Re-stub back for other tests
    vi.stubEnv("VITE_WORKER_URL", WORKER_URL);
  });
});
