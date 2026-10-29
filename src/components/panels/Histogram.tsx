interface HistogramProps {
  bins: number[];
}

export function Histogram({ bins }: HistogramProps) {
  const hasData = bins.some((value) => value > 0);
  return (
    <div className={`histogram ${hasData ? '' : 'is-empty'}`} aria-hidden="true">
      {bins.map((value, index) => (
        <span key={index} className="histogram__bar" style={{ height: `${Math.max(3, value * 100)}%` }} />
      ))}
    </div>
  );
}
