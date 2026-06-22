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
    initial: { opacity: 0, scale: 0.5, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.1, y: -4 },
    transition: { type: "spring", stiffness: 400, damping: 22 },
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
 * @param {boolean} [spotlight]
 */
export function revealCard(reduce = false, spotlight = false) {
  if (reduce) {
    return {
      initial: false,
      animate: { opacity: spotlight ? 1 : 0.55 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.96 },
    animate: {
      opacity: spotlight ? 1 : 0.45,
      scale: spotlight ? 1 : 0.97,
      y: spotlight ? 0 : 0,
    },
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
      animate: { opacity: 1, scale: 1 },
      transition: { duration: MOTION_FAST_SEC },
    };
  }
  return {
    initial: { opacity: 0.6, scale: 0.95 },
    animate: { opacity: 1, scale: 1.02 },
    transition: { type: "spring", stiffness: 280, damping: 20 },
  };
}

export const fibbageMotion = {
  phaseEnter,
  sectionEnter,
  cardStagger,
  scorePop,
  feedbackFlash,
  routeTransition,
  hostLabel,
  revealCard,
  truthReveal,
  feedbackOverlay: feedbackMotion.overlay,
};
