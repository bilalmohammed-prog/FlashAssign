export function CircuitDecor({
  className = "",
  position = "tl",
}: {
  className?: string;
  position?: "tl" | "br";
}) {
  const flip = position === "br";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 420 320"
      className={className}
      style={flip ? { transform: "scale(-1,-1)" } : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {/* Circuit traces */}
      <g opacity="0.5">
        <path d="M0 60 H110 L130 80 H210 L230 60 H320" />
        <path d="M0 130 H70 L90 150 H180" />
        <path d="M0 210 H60 L80 190 H160 L180 210 H280" />
        <path d="M230 60 V36 H320 V90" />
        <path d="M180 150 V230" />
        <circle cx="110" cy="60" r="2.5" fill="currentColor" />
        <circle cx="210" cy="80" r="2.5" fill="currentColor" />
        <circle cx="320" cy="60" r="2.5" fill="currentColor" />
        <circle cx="70" cy="130" r="2.5" fill="currentColor" />
        <circle cx="180" cy="150" r="2.5" fill="currentColor" />
        <circle cx="60" cy="210" r="2.5" fill="currentColor" />
        <circle cx="280" cy="210" r="2.5" fill="currentColor" />
      </g>

      {/* Large gear */}
      <g opacity="0.45" transform="translate(310 200)">
        <Gear radius={44} teeth={12} toothDepth={6} />
        <circle r="14" />
        <circle r="4" fill="currentColor" />
      </g>

      {/* Small gear */}
      <g opacity="0.4" transform="translate(372 158)">
        <Gear radius={22} teeth={10} toothDepth={4} />
        <circle r="7" />
        <circle r="2" fill="currentColor" />
      </g>
    </svg>
  );
}

function Gear({
  radius,
  teeth,
  toothDepth,
}: {
  radius: number;
  teeth: number;
  toothDepth: number;
}) {
  const step = (Math.PI * 2) / teeth;
  const inner = radius;
  const outer = radius + toothDepth;
  const half = step / 4;

  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const a1 = a - half;
    const a2 = a + half;
    const a3 = a + step / 2 - half;
    const a4 = a + step / 2 + half;
    points.push(`${outer * Math.cos(a1)},${outer * Math.sin(a1)}`);
    points.push(`${outer * Math.cos(a2)},${outer * Math.sin(a2)}`);
    points.push(`${inner * Math.cos(a3)},${inner * Math.sin(a3)}`);
    points.push(`${inner * Math.cos(a4)},${inner * Math.sin(a4)}`);
  }
  return <polygon points={points.join(" ")} />;
}
