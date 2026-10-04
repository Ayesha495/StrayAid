import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallback: ReactNode;
  fallbackClassName?: string;
};

function SafeImage({ src, fallback, fallbackClassName, className, alt, ...imgProps }: SafeImageProps) {
  // Remember *which* url failed rather than a plain boolean. That way a new src
  // (for example a freshly uploaded photo replacing a broken one) is tried again
  // instead of staying stuck on the fallback.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <div className={fallbackClassName ?? className}>{fallback}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
      {...imgProps}
    />
  );
}

export default SafeImage;
