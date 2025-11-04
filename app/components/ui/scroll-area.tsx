import * as React from "react";
import { cn } from "./utils";

export type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.4)_transparent]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

ScrollArea.displayName = "ScrollArea";
