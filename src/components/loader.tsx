export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      {label && <span className="ml-3 text-sm">{label}</span>}
    </div>
  );
}
