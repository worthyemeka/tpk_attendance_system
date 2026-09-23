"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function PagePreloader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    let minimumDone = false;
    let frameDone = false;
    const finish = () => { if (minimumDone && frameDone) setVisible(false); };
    const minimum = window.setTimeout(() => { minimumDone = true; finish(); }, 520);
    const frame = window.requestAnimationFrame(() => { frameDone = true; finish(); });
    return () => { window.clearTimeout(minimum); window.cancelAnimationFrame(frame); };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="page-preloader" role="status" aria-label="Loading">
      <div className="page-preloader-mark"><span /><span /><span /></div>
    </div>
  );
}
