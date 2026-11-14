export function TrendChart({
  points,
}: {
  points: { label: string; value: number }[];
}) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No points for this filter.</p>;
  }
  const width = 640;
  const height = 180;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length === 1 ? 0 : width / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - 16 - (point.value / max) * (height - 32);
    return { x, y, ...point };
  });
  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full text-primary" role="img">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="3" />
        {coords.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="3.5" fill="currentColor" />
        ))}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
