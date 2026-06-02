/** Stylized PCIe GPU for marketplace and checkout previews. */
export function GpuGraphicsCardIcon({ className = "h-7 w-7 text-accent" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3.5 7.5h17a1 1 0 011 1v7a1 1 0 01-1 1h-17a1 1 0 01-1-1v-7a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <circle cx="9.5" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9.5" cy="12" r="1.1" fill="currentColor" fillOpacity="0.35" />
      <path
        d="M14.5 9h6v6h-6v-6z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M16.2 11.2h2.6v1.6h-2.6v-1.6z" fill="currentColor" fillOpacity="0.45" />
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path
        d="M6.5 18.5v2M10 18.5v2M13.5 18.5v2M17 18.5v2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="square"
      />
    </svg>
  );
}
