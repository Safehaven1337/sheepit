'use client';

import React, { useState, useId, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DuoIconProps = React.SVGProps<SVGSVGElement>;

export function DuoSparkles({ className, ...props }: DuoIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'h-5 w-5'} {...props}>
      <path
        opacity="0.32"
        d="M5 17.65V19M5 19V20.35M5 19H6.35M5 19H3.65M5.7 3C5.95 4.51 6.85 5.45 8.4 5.7C6.85 5.95 5.95 6.89 5.7 8.4C5.45 6.89 4.55 5.95 3 5.7C4.55 5.45 5.45 4.51 5.7 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.9 3C13.54 8.04 15.53 11.14 21 12C15.81 12.81 13.57 15.73 12.9 21C12.23 15.73 9.99 12.81 4.8 12C9.99 11.19 12.23 8.27 12.9 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DuoUsers({ className, ...props }: DuoIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'h-5 w-5'} {...props}>
      <path
        opacity="0.32"
        d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DuoZap({ className, ...props }: DuoIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'h-5 w-5'} {...props}>
      <path opacity="0.28" d="M13 2L4 13h6l-1 9 9-11h-6l1-9Z" fill="currentColor" />
      <path
        d="M13 2L4 13h6l-1 9 9-11h-6l1-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DuoShield({ className, ...props }: DuoIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'h-5 w-5'} {...props}>
      <path opacity="0.28" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" fill="currentColor" />
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DuoCreditCard({ className, ...props }: DuoIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'h-5 w-5'} {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path opacity="0.32" d="M2 10h20" stroke="currentColor" strokeWidth="3.2" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function DuoSync({ className, ...props }: DuoIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'h-5 w-5'} {...props}>
      <path
        opacity="0.32"
        d="M20 12a8 8 0 0 0-8-8c-3.1 0-5.8 1.8-7.1 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 12a8 8 0 0 0 8 8c3.1 0 5.8-1.8 7.1-4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m4 4 1 4.5h4.5M20 20l-1-4.5h-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const DUO_ICONS = {
  sparkles: DuoSparkles,
  users: DuoUsers,
  zap: DuoZap,
  shield: DuoShield,
  billing: DuoCreditCard,
  sync: DuoSync,
};

export type BuiltInDuoIcon = keyof typeof DUO_ICONS;

export interface SplitFaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  icon?: BuiltInDuoIcon | 'none' | null;
  customIcon?: React.ReactNode;
  iconImage?: string;
}

export interface SplitFaqProps {
  items?: SplitFaqItem[];
  defaultOpenIndex?: number | null;
  gap?: number;
  radius?: number;
  bounce?: number;
  duration?: number;
  allowCloseAll?: boolean;
  showIcons?: boolean;
  className?: string;
}

export function SplitFaq({
  items = SAAS_FAQ_ITEMS,
  defaultOpenIndex = 0,
  gap = 14,
  radius = 20,
  bounce = 0.2,
  duration = 0.42,
  allowCloseAll = true,
  showIcons = true,
  className,
}: SplitFaqProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const toggle = useCallback(
    (i: number) => {
      setOpenIndex((cur) => (cur === i ? (allowCloseAll ? null : cur) : i));
    },
    [allowCloseAll]
  );

  const springTransition = useMemo(
    () => ({
      type: 'spring' as const,
      duration,
      bounce,
    }),
    [duration, bounce]
  );

  const edge = 6;
  const count = items.length;

  return (
    <LayoutGroup id={baseId}>
      <div className={cn('w-full max-w-xl mx-auto flex flex-col select-none px-4 sm:px-0', className)}>
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          const isHover = hoveredIndex === i;

          const startsGroup = i === 0 || (openIndex !== null && (i === openIndex || i === openIndex + 1));
          const endsGroup = i === count - 1 || (openIndex !== null && (i === openIndex || i === openIndex - 1));
          const splitAbove = i > 0 && openIndex !== null && (i === openIndex || i === openIndex + 1);

          const panelId = `${baseId}-panel-${i}`;
          const buttonId = `${baseId}-button-${i}`;
          const IconComponent = item.icon && item.icon !== "none" ? DUO_ICONS[item.icon] : null;

          return (
            <motion.div
              key={item.id}
              layout
              initial={false}
              animate={{
                borderTopLeftRadius: startsGroup ? radius : 0,
                borderTopRightRadius: startsGroup ? radius : 0,
                borderBottomLeftRadius: endsGroup ? radius : 0,
                borderBottomRightRadius: endsGroup ? radius : 0,
              }}
              transition={springTransition}
              style={{
                marginTop: splitAbove ? gap : 0,
                paddingTop: startsGroup ? edge : 0,
                paddingBottom: endsGroup ? edge : 0,
                willChange: 'transform',
              }}
              className={cn(
                'relative overflow-hidden bg-white dark:bg-neutral-800 transition-shadow duration-200',
                isOpen
                  ? 'z-10 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.08),0_4px_10px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_14px_32px_-6px_rgba(0,0,0,0.5)]'
                  : 'z-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
              )}
            >
              <motion.button
                layout="position"
                transition={springTransition}
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                onClick={() => toggle(i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                className={cn(
                  'group w-[calc(100%-8px)] mx-1 sm:w-[calc(100%-12px)] sm:mx-1.5 flex items-center justify-between gap-2.5 sm:gap-3.5 px-2.5 sm:px-3.5 py-2.5 sm:py-3 rounded-xl text-left text-sm font-medium transition-colors outline-none cursor-pointer',
                  isHover ? 'bg-black/[0.04] dark:bg-white/[0.05]' : 'bg-transparent'
                )}
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-1.5 sm:pr-2">
                  {showIcons && IconComponent && (
                    <span
                      className={cn(
                        'shrink-0 transition-colors duration-180',
                        isOpen
                          ? 'text-primary'
                          : 'text-neutral-500 dark:text-neutral-400 group-hover:text-foreground'
                      )}
                    >
                      <IconComponent className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                    </span>
                  )}

                  {showIcons && item.iconImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.iconImage}
                      alt=""
                      className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0 rounded-md object-cover"
                    />
                  )}

                  <span
                    className={cn(
                      'text-xs sm:text-sm font-medium tracking-tight leading-snug transition-colors duration-180',
                      isOpen
                        ? 'text-foreground font-semibold'
                        : 'text-neutral-700 dark:text-neutral-300 group-hover:text-foreground'
                    )}
                  >
                    {item.question}
                  </span>
                </div>

                <motion.span
                  initial={false}
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={springTransition}
                  className={cn(
                    'flex shrink-0 transition-colors duration-180',
                    isOpen
                      ? 'text-primary'
                      : 'text-neutral-400 dark:text-neutral-500 group-hover:text-foreground'
                  )}
                >
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </motion.span>
              </motion.button>

              <AnimatePresence initial={false} mode="popLayout">
                {isOpen && (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    layout="position"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.08 } }}
                    transition={{
                      ...springTransition,
                      opacity: { duration: 0.2, delay: 0.06 },
                    }}
                  >
                    <p className="m-0 px-3.5 sm:px-5 pb-3.5 sm:pb-4 pt-1 text-xs sm:text-[13px] leading-relaxed text-muted-foreground/90">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export const SAAS_FAQ_ITEMS: SplitFaqItem[] = [
  {
    id: 'free-trial',
    icon: 'sparkles',
    question: 'How does the 14-day free trial work?',
    answer:
      'You get unrestricted access to all Pro features for 14 days without entering a credit card. If you decide not to upgrade at the end of your trial, your workspace automatically transitions to our free tier with zero data loss or service disruption.',
  },
  {
    id: 'team-permissions',
    icon: 'users',
    question: 'Can I invite team members and set custom role permissions?',
    answer:
      'Yes. You can invite unlimited team members and assign granular permissions (Owner, Admin, Member, or Guest). Enterprise plans also support SAML SSO, Okta directory sync, and automated domain-level provisioning.',
  },
  {
    id: 'usage-limits',
    icon: 'zap',
    question: 'What happens if our workspace exceeds monthly API limits?',
    answer:
      'We never cut off live production traffic unexpectedly. When your team reaches 80% and 95% of your quota, automated webhooks alert your team. Overages are billed at transparent flat-rate tiers, or you can configure hard caps directly in settings.',
  },
  {
    id: 'security-compliance',
    icon: 'shield',
    question: 'Do you offer SOC-2 Type II compliance and data encryption?',
    answer:
      'Yes. All data is encrypted in transit via TLS 1.3 and at rest with AES-256 encryption. We are SOC-2 Type II certified, fully GDPR compliant, and undergo continuous third-party penetration testing. Audit reports and DPAs are available upon request.',
  },
  {
    id: 'billing-switching',
    icon: 'billing',
    question: 'Can I switch plans or cancel my subscription at any time?',
    answer:
      'Yes, you can upgrade, downgrade, or cancel anytime directly in your billing dashboard with one click. Upgrades are pro-rated automatically so you only pay for the time used. If you cancel, all features remain active until your billing period ends.',
  },
  {
    id: 'offline-sync',
    icon: 'sync',
    question: 'How does real-time sync handle offline conflict resolution?',
    answer:
      'Our engine utilizes local CRDTs (Conflict-free Replicated Data Types) paired with an optimistic state store. Any edits made while offline are queued locally and merged deterministically the moment network connectivity is re-established.',
  },
];

export default function SplitFaqDemo() {
  return (
    <div className="w-full min-h-full py-8 sm:py-16 px-3 sm:px-6 flex items-center justify-center">
      <SplitFaq
        items={SAAS_FAQ_ITEMS}
        defaultOpenIndex={0}
        gap={14}
        radius={20}
        bounce={0.2}
        duration={0.42}
        allowCloseAll={true}
        showIcons={true}
      />
    </div>
  );
}
