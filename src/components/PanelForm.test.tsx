import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PanelForm from "./PanelForm";

describe("PanelForm", () => {
  it("renders HP input, format select, hole style select, quantity input, and add button", () => {
    render(<PanelForm onAdd={vi.fn()} />);

    expect(screen.getByLabelText(/^HP$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Format$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Hole Style$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Quantity$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("defaults quantity to 1", () => {
    render(<PanelForm onAdd={vi.fn()} />);
    const quantityInput = screen.getByLabelText(/^Quantity$/i);
    expect(quantityInput).toHaveValue(1);
  });

  it("defaults HP to 8", () => {
    render(<PanelForm onAdd={vi.fn()} />);
    const hpInput = screen.getByLabelText(/^HP$/i);
    expect(hpInput).toHaveValue(8);
  });

  it("calls onAdd with correct values when submitted with defaults", async () => {
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    const addButton = screen.getByRole("button", { name: /add/i });
    await userEvent.click(addButton);

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith({
      hp: 8,
      format: "3u",
      holeStyle: "slot",
      quantity: 1,
    });
  });

  it("calls onAdd with updated HP when user changes it", async () => {
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    const hpInput = screen.getByLabelText(/^HP$/i);
    await userEvent.clear(hpInput);
    await userEvent.type(hpInput, "16");

    const addButton = screen.getByRole("button", { name: /add/i });
    await userEvent.click(addButton);

    expect(onAdd).toHaveBeenCalledWith({
      hp: 16,
      format: "3u",
      holeStyle: "slot",
      quantity: 1,
    });
  });

  it("shows validation error for HP < 1", async () => {
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    const hpInput = screen.getByLabelText(/^HP$/i);
    await userEvent.clear(hpInput);
    await userEvent.type(hpInput, "0");

    const addButton = screen.getByRole("button", { name: /add/i });
    await userEvent.click(addButton);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/hp must be/i)).toBeInTheDocument();
  });

  it("shows validation error for HP > 128", async () => {
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    const hpInput = screen.getByLabelText(/^HP$/i);
    await userEvent.clear(hpInput);
    await userEvent.type(hpInput, "200");

    const addButton = screen.getByRole("button", { name: /add/i });
    await userEvent.click(addButton);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/hp must be/i)).toBeInTheDocument();
  });

  it("shows validation error for quantity < 1", async () => {
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    const quantityInput = screen.getByLabelText(/^Quantity$/i);
    await userEvent.clear(quantityInput);
    await userEvent.type(quantityInput, "0");

    const addButton = screen.getByRole("button", { name: /add/i });
    await userEvent.click(addButton);

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/quantity must be/i)).toBeInTheDocument();
  });

  it("clears error after successful submission", async () => {
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    // First cause an error
    const hpInput = screen.getByLabelText(/^HP$/i);
    await userEvent.clear(hpInput);
    await userEvent.type(hpInput, "0");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(screen.getByText(/hp must be/i)).toBeInTheDocument();

    // Fix the value and submit successfully
    await userEvent.clear(hpInput);
    await userEvent.type(hpInput, "8");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.queryByText(/hp must be/i)).not.toBeInTheDocument();
  });

  it("does not show error on initial render", () => {
    render(<PanelForm onAdd={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
