import { useEffect, useRef } from 'react'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'

export const EASE = [0.22, 1, 0.36, 1]

export const pageVariants = {
  initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: EASE },
    transitionEnd: { filter: 'none' },
  },
  exit: {
    opacity: 0,
    y: -16,
    filter: 'blur(8px)',
    transition: { duration: 0.35, ease: 'easeIn' },
  },
}

export function Reveal({ children, delay = 0, y = 28, className = '', as = 'div', once = true }) {
  const Component = motion[as]
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </Component>
  )
}

export function Stagger({ children, className = '', as = 'div', delay = 0, gap = 0.08, inView = false, ...rest }) {
  const Component = motion[as]
  const trigger = inView
    ? { whileInView: 'show', viewport: { once: true, margin: '-60px' } }
    : { animate: 'show' }
  return (
    <Component
      className={className}
      initial="hidden"
      {...trigger}
      {...rest}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </Component>
  )
}

export const itemVariants = {
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
}

export function StaggerItem({ children, className = '', as = 'div', ...rest }) {
  const Component = motion[as]
  return (
    <Component className={className} variants={itemVariants} {...rest}>
      {children}
    </Component>
  )
}

export function CountUp({ value = 0, duration = 1.6, decimals = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return
    const target = Number(value) || 0
    if (reduce) {
      node.textContent = target.toFixed(decimals)
      return
    }
    const controls = animate(0, target, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = v.toFixed(decimals)
      },
    })
    return () => controls.stop()
  }, [inView, value, duration, decimals, reduce])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}

export function SplitText({ text, className = '', delay = 0, stagger = 0.06 }) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {text.split(' ').map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span
            className="inline-block"
            initial={{ y: '110%', opacity: 0, rotate: 4 }}
            animate={{ y: '0%', opacity: 1, rotate: 0 }}
            transition={{ duration: 1, delay: delay + i * stagger, ease: EASE }}
          >
            {word}
            {'\u00A0'}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

export function Magnetic({ children, strength = 0.25, className = '' }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 15 })
  const sy = useSpring(y, { stiffness: 200, damping: 15 })

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - rect.left - rect.width / 2) * strength)
    y.set((e.clientY - rect.top - rect.height / 2) * strength)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      className={`inline-block ${className}`}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  )
}

export function TiltCard({ children, className = '', max = 8 }) {
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 180, damping: 18 })
  const rotateY = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 180, damping: 18 })
  const glow = useTransform(
    [mx, my],
    ([x, y]) => `radial-gradient(320px circle at ${x * 100}% ${y * 100}%, rgba(159,217,192,0.35), transparent 60%)`,
  )

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - rect.left) / rect.width)
    my.set((e.clientY - rect.top) / rect.height)
  }
  const onLeave = () => {
    mx.set(0.5)
    my.set(0.5)
  }

  return (
    <motion.div
      className={`group relative [transform-style:preserve-3d] ${className}`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />
      {children}
    </motion.div>
  )
}

export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-mint/40 blur-3xl"
        animate={{ x: [0, 80, -20, 0], y: [0, 40, 90, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-amber/15 blur-3xl"
        animate={{ x: [0, -70, 30, 0], y: [0, 60, -40, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-12rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-leaf/20 blur-3xl"
        animate={{ x: [0, 60, -60, 0], y: [0, -50, 20, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="grain absolute inset-0" />
    </div>
  )
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.25em] text-leaf"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {eyebrow}
          </motion.p>
        )}
        <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
          <SplitText text={title} delay={0.1} />
        </h1>
        <motion.div
          className="mt-2 h-[3px] w-16 origin-left rounded-full bg-gradient-to-r from-coral to-mint"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
        />
        {subtitle && (
          <motion.p
            className="mt-3 text-moss"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {children && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}

export function Loader({ label = 'Chargement…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-moss">
      <div className="relative h-12 w-12">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-mint"
          animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.span
          className="absolute inset-2 rounded-full border-2 border-t-coral border-r-transparent border-b-leaf border-l-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <motion.p
        className="text-sm tracking-wide"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        {label}
      </motion.p>
    </div>
  )
}
