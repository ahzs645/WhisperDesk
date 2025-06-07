import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner";

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <Sonner
        theme={theme}
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
