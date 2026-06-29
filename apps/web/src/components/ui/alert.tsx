import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheck, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-4 border-l-2 p-4",
  {
    variants: {
      variant: {
        info: "bg-info text-info-foreground border-info-foreground",
        success: "bg-success text-success-foreground border-success-foreground",
        warning: "bg-warning text-warning-foreground border-warning-foreground",
        error: "bg-error text-error-foreground border-error-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const alertIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant, title, children, ...props }: AlertProps) {
  const Icon = variant ? alertIcons[variant] : Info;
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-sm leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
