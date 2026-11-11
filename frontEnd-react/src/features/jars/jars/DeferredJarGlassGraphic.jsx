import { useEffect, useRef, useState } from 'react';
import { JarGlassGraphic } from '../JarGlassGraphic';

export function DeferredJarGlassGraphic(props) {
  const hostRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || shouldRender) return undefined;
    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setShouldRender(true);
      observer.disconnect();
    }, { rootMargin: '240px 0px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={hostRef} className="jar-graphic-deferred-host" aria-hidden="true">
      {shouldRender ? (
        <JarGlassGraphic {...props} />
      ) : (
        <span className="jar-graphic-deferred-placeholder">{Math.max(0, Math.min(100, Number(props.percent) || 0))}%</span>
      )}
    </div>
  );
}
