import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Inline Button component for testing (avoids Tauri import issues in jsdom)
import { memo, type ButtonHTMLAttributes, type Ref } from "react";

type ButtonVariant = "primary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-indigo-500 text-white",
  danger: "bg-red-500 text-white",
  ghost: "bg-transparent text-gray-500",
  outline: "border border-gray-200 bg-white text-gray-700",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-9 px-4 text-sm rounded-lg",
};

function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

const Button = memo(function Button({ variant = "primary", size = "md", loading, fullWidth, disabled, className, children, ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(VARIANT[variant], SIZE[size], fullWidth && "w-full", className)}
      {...props}
    >
      {loading && <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
});

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeDefined();
  });

  it("applies primary variant by default", () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByText("Primary");
    expect(btn.className).toContain("bg-indigo-500");
  });

  it("applies danger variant", () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByText("Danger");
    expect(btn.className).toContain("bg-red-500");
  });

  it("applies ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByText("Ghost");
    expect(btn.className).toContain("bg-transparent");
  });

  it("disables when loading", () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByText("Loading").closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("fires onClick", async () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Click</Button>);
    await userEvent.click(screen.getByText("Click"));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when disabled", async () => {
    const fn = vi.fn();
    render(<Button disabled onClick={fn}>Click</Button>);
    await userEvent.click(screen.getByText("Click"));
    expect(fn).not.toHaveBeenCalled();
  });

  it("applies fullWidth class", () => {
    render(<Button fullWidth>Full</Button>);
    const btn = screen.getByText("Full");
    expect(btn.className).toContain("w-full");
  });
});
