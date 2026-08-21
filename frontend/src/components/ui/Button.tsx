import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "primary-button",
  ghost: "ghost-button",
  icon: "icon-button",
};

export default function Button({ variant = "ghost", className = "", children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${VARIANT_CLASS[variant]} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
