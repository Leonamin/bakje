import { useState, useEffect } from "react";

export function Avatar({
  src,
  name,
  size = 44,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const [hasError, setHasError] = useState(false);
  useEffect(() => setHasError(false), [src]);
  return (
    <span className="gc-avatar" style={{ width: size, height: size }}>
      {src && !hasError ? (
        <img src={src} alt={name} onError={() => setHasError(true)} />
      ) : (
        <span role="img" aria-label={name}>
          {name.trim().slice(0, 2)}
        </span>
      )}
    </span>
  );
}
