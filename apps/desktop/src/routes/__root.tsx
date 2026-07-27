import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TooltipProvider } from "@dahoko/ui";
import { StoreProvider } from "@/state/store";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <div className="h-dvh overflow-hidden bg-background text-foreground">
          <Outlet />
        </div>
      </TooltipProvider>
    </StoreProvider>
  );
}
