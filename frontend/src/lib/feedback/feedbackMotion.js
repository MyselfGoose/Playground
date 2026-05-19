export const feedbackMotion = {
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  timerUrgent: {
    filter: "brightness(1.04)",
    transition: { duration: 0.45, ease: "easeOut" },
  },
};
