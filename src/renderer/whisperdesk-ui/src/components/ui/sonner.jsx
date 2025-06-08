import { Toaster as Sonner, toast } from "sonner";
import { useAppState } from "../../App";

const Toaster = ({
  ...props
}) => {
  const { appState } = useAppState()
  const currentTheme = appState.theme === "system"
    ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : appState.theme

  return (
    <>
      <Sonner
        theme={currentTheme}
        className="toaster group"
        style={{
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)"
        }}
        {...props}
      />
      <button
        className="dismiss-all hidden group-hover:block fixed bottom-1 right-1 z-[1001] text-xs px-2 py-1 bg-background border rounded shadow"
        onClick={() => toast.dismiss()}
      >
        Clear All
      </button>
    </>
  );
}

export { Toaster }
