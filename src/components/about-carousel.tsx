'use client';
// Adapted from React Bits Carousel's Motion track, drag, and indicator pattern.
// See docs/REACT_BITS_LICENSE.md. Responsive width and accessible controls are specific to Turnout.
import Link from 'next/link';
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  MapPin,
  MessageSquare,
  Repeat2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type AboutSlide = {
  label: string;
  title: string;
  description: string;
  theme: string;
  action: { label: string; href: string };
  details: { icon: LucideIcon; title: string; description: string }[];
};
const slides: AboutSlide[] = [
  {
    label: 'What is Turnout?',
    title: 'Service events in your community',
    description:
      'Turnout brings volunteers and local organizations together. Find a way to help, join a service event, and keep the details in one place.',
    theme: 'purple',
    action: { label: 'Explore opportunities', href: '/browse' },
    details: [
      {
        icon: Compass,
        title: 'Discover',
        description: 'Find opportunities by location, organizing group, or task.',
      },
      {
        icon: CheckCircle2,
        title: 'Participate',
        description: 'Reserve a volunteer task that fits how you want to help.',
      },
      {
        icon: MapPin,
        title: 'Show up prepared',
        description: 'See when to arrive, where to meet, and what to bring.',
      },
    ],
  },
  {
    label: 'Who is it for?',
    title: 'For volunteers and organizations.',
    description:
      'Whether you have a few hours to give or an event to organize, Turnout helps you connect with your community.',
    theme: 'yellow',
    action: { label: 'Meet the organizations', href: '/community' },
    details: [
      {
        icon: Users,
        title: 'Volunteers',
        description:
          'Find service events, choose a task, connect with participants, and keep track of verified hours.',
      },
      {
        icon: CalendarDays,
        title: 'Organizations',
        description:
          'Create a group, publish events, manage volunteer places, and record attendance.',
      },
    ],
  },
  {
    label: 'What can you do?',
    title: 'Plan, participate, and stay connected.',
    description:
      'Turnout connects the steps before, during, and after an event, so everyone knows how to contribute.',
    theme: 'plum',
    action: { label: 'Find your next event', href: '/browse' },
    details: [
      {
        icon: CheckCircle2,
        title: 'Choose a task',
        description: 'Reserve a place in an available volunteer role.',
      },
      {
        icon: Repeat2,
        title: 'Make it recurring',
        description: 'Organizers can schedule weekly or biweekly events.',
      },
      {
        icon: MessageSquare,
        title: 'Coordinate together',
        description: 'Use event conversations to share updates and questions.',
      },
      {
        icon: Clock3,
        title: 'Record your service',
        description: 'Organizer-verified attendance updates your service hours.',
      },
    ],
  },
];
const GAP = 20;
const spring = { type: 'spring' as const, stiffness: 260, damping: 32 };

export function AboutCarousel() {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const offset = width + GAP;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const animation = animate(x, -index * offset, reducedMotion ? { duration: 0 } : spring);
    return () => animation.stop();
  }, [index, offset, reducedMotion, x]);

  const goTo = (position: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, position));
    setIndex(next);
    // Also settle back after a short drag or a drag beyond the first/last card.
    animate(x, -next * offset, reducedMotion ? { duration: 0 } : spring);
  };
  const finishDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const moved = Math.abs(info.offset.x) >= 45 || Math.abs(info.velocity.x) >= 450;
    const direction = info.offset.x === 0 ? Math.sign(info.velocity.x) : Math.sign(info.offset.x);
    goTo(index - (moved ? direction : 0));
  };

  return (
    <section className="about-carousel" aria-label="About Turnout" aria-roledescription="carousel">
      <div className="about-carousel-heading">
        <p className="eyebrow">ABOUT TURNOUT</p>
        <span className="carousel-chapter" aria-live="polite" aria-atomic="true">
          {String(index + 1).padStart(2, '0')} / 03 <span>{slides[index].label}</span>
        </span>
      </div>
      <div
        ref={viewport}
        className="about-carousel-viewport"
        tabIndex={0}
        aria-label="Introduction cards. Use left and right arrow keys to change cards."
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          goTo(
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? slides.length - 1
                : index + (event.key === 'ArrowRight' ? 1 : -1),
          );
        }}
      >
        <motion.div
          className="about-carousel-track"
          style={{ x, gap: GAP }}
          drag={width ? 'x' : false}
          dragConstraints={{ left: -(slides.length - 1) * offset, right: 0 }}
          dragElastic={0.08}
          dragMomentum={false}
          onDragEnd={finishDrag}
        >
          {slides.map((slide, i) => (
            <article
              key={slide.label}
              id={`about-slide-${i + 1}`}
              className={`about-slide ${slide.theme}`}
              style={{ width: width || '100%' }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}: ${slide.label}`}
              aria-hidden={index !== i}
              inert={index !== i}
            >
              <div className="about-slide-copy">
                <span className="about-slide-label">{slide.label}</span>
                <h2>{slide.title}</h2>
                <p>{slide.description}</p>
                <Link
                  className="button white"
                  href={slide.action.href}
                  draggable={false}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {slide.action.label}
                  <ArrowRight size={18} />
                </Link>
              </div>
              <div className={`about-slide-details ${i === 2 ? 'detail-tiles' : ''}`}>
                {slide.details.map(({ icon: Icon, title, description }) => (
                  <div className="about-detail" key={title}>
                    <span className="about-detail-icon">
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </motion.div>
      </div>
      <div className="about-carousel-controls" role="group" aria-label="Carousel controls">
        <div className="carousel-indicators">
          {slides.map((slide, i) => (
            <button
              key={slide.label}
              type="button"
              aria-label={`Go to slide ${i + 1}: ${slide.label}`}
              aria-current={index === i ? 'true' : undefined}
              aria-controls={`about-slide-${i + 1}`}
              onClick={() => goTo(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <span className="carousel-hint">Drag or use the arrows to explore</span>
        <div className="carousel-arrows">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous slide"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next slide"
            disabled={index === slides.length - 1}
            onClick={() => goTo(index + 1)}
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
