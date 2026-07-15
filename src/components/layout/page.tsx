import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("page-stack", className)} {...props} />;
}

interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn("page-header", className)} {...props}>
      <div className="min-w-0">
        {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function PageSection({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("page-section", className)} {...props} />;
}

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function SectionHeader({ title, description, actions, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("section-header", className)} {...props}>
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
  );
}
