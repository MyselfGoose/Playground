import { feedbackMotion } from "../feedback/feedbackMotion.js";

/** Matches --motion-normal (220ms) in globals.css */
export const MOTION_NORMAL_SEC = 0.22;
export const MOTION_FAST_SEC = 0.12;
export const FIBBAGE_EASE = [0.22, 1, 0.36, 1];

/**
 * @param {boolean} reduce
 * @returns {import('framer-motion').Variants}
 */
export function phaseEnter(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: MOTION_NORMAL_SEC, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {boolean} reduce
 * @param {number} [delay]
 */
export function sectionEnter(reduce = false, delay = 0) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { delay },
    };
  }
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: MOTION_NORMAL_SEC, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {number} index
 * @param {boolean} reduce
 */
export function cardStagger(index = 0, reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { delay: index * 0.02 },
    };
  }
  return {
    initial: { opacity: 0, y: 16, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: {
      delay: index * 0.06,
      duration: MOTION_NORMAL_SEC,
      ease: FIBBAGE_EASE,
    },
  };
}

/**
 * @param {boolean} reduce
 */
export function scorePop(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, y: 8, scale: 0.85 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -6, scale: 0.95 },
    transition: { duration: 0.35, ease: FIBBAGE_EASE },
  };
}

/**
 * Amplified score burst for point reveals.
 * @param {boolean} reduce
 */
export function scoreBurst(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1, scale: 1 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.5, y: 12 },
    animate: { opacity: 1, scale: [0.5, 1.2, 1], y: 0 },
    transition: { duration: 0.5, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {boolean} reduce
 */
export function feedbackFlash(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.85 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.08 },
    transition: { duration: 0.3, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {boolean} reduce
 */
export function routeTransition(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
    transition: { duration: 0.35, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {boolean} reduce
 */
export function hostLabel(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 },
    transition: { duration: MOTION_NORMAL_SEC, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {boolean} reduce
 * @param {boolean} [_spotlight] Kept for API compatibility; spotlight uses CSS classes.
 */
export function revealCard(reduce = false, _spotlight = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.35, ease: FIBBAGE_EASE },
  };
}

/**
 * @param {boolean} reduce
 */
export function truthReveal(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: [0.94, 1.03, 1] },
    transition: { duration: 0.45, ease: FIBBAGE_EASE },
  };
}

/**
 * Staggered reveal beat (author, voters, points) — slide up + fade.
 * @param {boolean} reduce
 */
export function revealBeat(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.32, ease: FIBBAGE_EASE },
  };
}

/**
 * Voter chip stagger entrance.
 * @param {number} index
 * @param {boolean} reduce
 */
export function voterStagger(index = 0, reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1, scale: 1 },
      transition: { delay: index * 0.02 },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.8, x: -8 },
    animate: { opacity: 1, scale: 1, x: 0 },
    transition: { delay: index * 0.08, duration: 0.28, ease: FIBBAGE_EASE },
  };
}

/**
 * Rank change arrow pop.
 * @param {boolean} reduce
 */
export function rankPop(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.5, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.35, type: "spring", stiffness: 400, damping: 18 },
  };
}

/**
 * Podium entrance.
 * @param {number} index
 * @param {boolean} reduce
 */
export function podiumEnter(index = 0, reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { delay: index * 0.05 },
    };
  }
  return {
    initial: { opacity: 0, y: 40, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: 0.15 + index * 0.12, duration: 0.55, ease: FIBBAGE_EASE },
  };
}

/**
 * Inner content expand (author / voters) — opacity + height, no spring.
 * @param {boolean} reduce
 */
export function contentExpand(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1, height: "auto" },
      exit: { opacity: 0, height: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.28, ease: FIBBAGE_EASE },
  };
}

/**
 * Opacity-only crossfade for recap carousel.
 * @param {boolean} reduce
 * @param {boolean} [isFirst]
 */
export function recapCard(reduce = false, isFirst = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: isFirst ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.32, ease: FIBBAGE_EASE },
  };
}

/**
 * Generic opacity crossfade.
 * @param {boolean} reduce
 */
export function crossfade(reduce = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.28, ease: FIBBAGE_EASE },
  };
}

/**
 * Shared prompt bridge across phases.
 * @param {string} layoutId
 * @param {boolean} reduce
 */
export function promptBridge(layoutId, reduce = false) {
  if (reduce) {
    return { layoutId };
  }
  return {
    layoutId,
    transition: { duration: 0.35, ease: FIBBAGE_EASE },
  };
}

export const fibbageMotion = {
  phaseEnter,
  sectionEnter,
  cardStagger,
  scorePop,
  scoreBurst,
  feedbackFlash,
  routeTransition,
  hostLabel,
  revealCard,
  truthReveal,
  revealBeat,
  voterStagger,
  rankPop,
  podiumEnter,
  contentExpand,
  recapCard,
  crossfade,
  promptBridge,
  feedbackOverlay: feedbackMotion.overlay,
};
