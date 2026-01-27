"use client";

import { motion, HTMLMotionProps, Variants } from "framer-motion";
import { forwardRef, ReactNode } from "react";

// Animation variants for common use cases
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Default transition
export const defaultTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

export const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

// Motion wrapper components
interface MotionDivProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
}

export const MotionDiv = forwardRef<HTMLDivElement, MotionDivProps>(
  ({ children, ...props }, ref) => (
    <motion.div ref={ref} {...props}>
      {children}
    </motion.div>
  )
);
MotionDiv.displayName = "MotionDiv";

// Fade in component
interface FadeInProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  direction = "up",
  ...props
}: FadeInProps) {
  const getVariants = () => {
    switch (direction) {
      case "up":
        return fadeInUp;
      case "down":
        return fadeInDown;
      case "left":
        return fadeInLeft;
      case "right":
        return fadeInRight;
      default:
        return fadeIn;
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={getVariants()}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Stagger children component
interface StaggerProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: ReactNode;
  staggerDelay?: number;
  delayStart?: number;
}

export function Stagger({
  children,
  staggerDelay = 0.05,
  delayStart = 0,
  ...props
}: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren: delayStart,
            staggerChildren: staggerDelay,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Stagger item for use inside Stagger
interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: ReactNode;
}

export function StaggerItem({ children, ...props }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Scale on tap/hover
interface ScaleOnInteractProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  hoverScale?: number;
  tapScale?: number;
}

export function ScaleOnInteract({
  children,
  hoverScale = 1.02,
  tapScale = 0.98,
  ...props
}: ScaleOnInteractProps) {
  return (
    <motion.div
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={springTransition}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Page transition wrapper
interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// List animation wrapper
interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedList({ children, className }: AnimatedListProps) {
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.ul>
  );
}

// List item
interface AnimatedListItemProps extends HTMLMotionProps<"li"> {
  children: ReactNode;
}

export function AnimatedListItem({ children, ...props }: AnimatedListItemProps) {
  return (
    <motion.li
      variants={staggerItem}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      {...props}
    >
      {children}
    </motion.li>
  );
}

// Export motion primitives for custom use
export { motion, AnimatePresence } from "framer-motion";
export type { Variants } from "framer-motion";
