// Centralizes the logo image so its "zoom" (crop level) can be tuned in
// ONE place. object-fit: cover + a scale() transform crops in from all
// sides equally, compensating for blank padding baked into logo.png itself
// — increase `zoom` to crop in tighter, decrease it to show more margin.
export default function Logo({ zoom = 1.6, rotate = 0, className = "" }: { zoom?: number; rotate?: number; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <img
        src="/logo.png"
        alt="MTCC UAE"
        className="w-full h-full object-cover"
        style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
      />
    </div>
  );
}
