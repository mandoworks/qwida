import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink border-accent",
  secondary: "bg-surface text-ink border-ink",
  danger: "bg-danger text-white border-danger",
};

const BASE =
  "flex w-full min-h-btn-patient items-center justify-center gap-3 rounded-2xl border-2 px-6 py-4 text-patient font-bold text-center transition-transform active:scale-[0.98] disabled:opacity-50";

type Common = { variant?: Variant; icon?: ReactNode; children: ReactNode; className?: string };
type AsLink = Common & { href: string };
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "children" | "className">;

/** Patient grade button: full width, 72px minimum, 24px text. Renders a link when `href` is set. */
export function BigButton({ variant = "primary", icon, children, className = "", href, ...rest }: AsLink | AsButton) {
  const cls = `${BASE} ${VARIANTS[variant]} ${className}`;
  const content = (
    <>
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </>
  );
  if (href !== undefined) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" {...rest} className={cls}>
      {content}
    </button>
  );
}
