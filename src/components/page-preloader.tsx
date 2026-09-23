"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function PagePreloader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 380);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="page-preloader" role="status" aria-label="Loading">
      <div className="page-preloader-mark"><span /><span /><span /></div>
    </div>
  );
}
