"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { shouldAnimateRouteTransition } from "../lib/routing/routeTransition.js";

export default function Template({ children }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const animate = !reduce && shouldAnimateRouteTransition(pathname);

  if (!animate) {
    return <div className="flex flex-1 flex-col">{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
