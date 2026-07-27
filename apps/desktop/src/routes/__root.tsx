import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TooltipProvider } from "@dahoko/ui";
import { StoreProvider } from "@/state/store";
import { SettingsProvider } from "@/state/settings";
import { SyncProvider } from "@/state/sync";
import { UpdaterProvider } from "@/state/updater";
import { TitleBar } from "@/components/title-bar";
import { UpdateDialog } from "@/components/update-dialog";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <UpdaterProvider>
      <SettingsProvider>
        <StoreProvider>
          <SyncProvider>
            <TooltipProvider>
              <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
                <TitleBar />
                <div className="min-h-0 flex-1">
                  <Outlet />
                </div>
              </div>
              <UpdateDialog />
            </TooltipProvider>
          </SyncProvider>
        </StoreProvider>
      </SettingsProvider>
    </UpdaterProvider>
  );
}
