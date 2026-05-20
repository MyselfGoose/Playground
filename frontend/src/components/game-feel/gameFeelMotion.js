/** Matches --motion-normal (220ms) in globals.css */
export const MOTION_NORMAL_SEC = 0.22;

export const gameFeelMotion = {
  countdownBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: MOTION_NORMAL_SEC, ease: [0.22, 1, 0.36, 1] },
  },
  countdownStep: {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.1, opacity: 0 },
    transition: { type: "spring", stiffness: 320, damping: 22 },
  },
  countdownStepReduced: {
    initial: false,
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: MOTION_NORMAL_SEC },
  },
  winnerBanner: {
    initial: { opacity: 0, scale: 0.92, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 8 },
    transition: { duration: MOTION_NORMAL_SEC, ease: [0.22, 1, 0.36, 1] },
  },
  winnerBannerReduced: {
    initial: false,
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: MOTION_NORMAL_SEC },
  },
};

export const COUNTDOWN_STEPS = /** @type {const} */ (["3", "2", "1", "GO"]);
