"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, TrendingUp, Shield, Coins, Twitter, Users, Scale, Clock, Award } from "lucide-react";
import { GlassCard, GlassCardContent } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";

interface FAQItem {
  question: string;
  answer: string | string[];
  icon: React.ElementType;
}

const faqCategories: { title: string; items: FAQItem[] }[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is a prediction market?",
        answer: [
          "A prediction market is a platform where you can bet on the outcome of future events. Vault Markets uses a pari-mutuel system where all bets are pooled together and winners share the pool proportionally.",
          "Each market poses a question with two possible outcomes. The percentage shown for each outcome reflects how much has been bet on that side—a higher percentage means more people are betting on it.",
        ],
        icon: TrendingUp,
      },
      {
        question: "How do I get started?",
        answer: [
          "Sign in with your X (Twitter) account to create your Vault Markets profile. You'll receive a starting balance of $10,000 in virtual credits to begin trading.",
          "Browse available markets, find one that interests you, select your predicted outcome, and place your bet. It's that simple!",
        ],
        icon: HelpCircle,
      },
      {
        question: "Is this real money?",
        answer: "No. Vault Markets uses virtual credits for entertainment and educational purposes. Your starting balance and all winnings are virtual currency that cannot be withdrawn or exchanged for real money. This allows you to experience the excitement of prediction markets without financial risk.",
        icon: Coins,
      },
    ],
  },
  {
    title: "How Betting Works",
    items: [
      {
        question: "How do I place a bet?",
        answer: [
          "Navigate to any open market and click on the outcome you want to bet on. Enter the amount you'd like to wager, then confirm your prediction.",
          "To finalize your bet, you'll need to share your prediction on X (Twitter). This social proof mechanism ensures transparency and creates a verifiable record of your prediction.",
        ],
        icon: TrendingUp,
      },
      {
        question: "What do the percentages mean?",
        answer: [
          "Percentages represent the current implied probability of each outcome based on how much has been bet on each side. If an outcome shows 65%, the market collectively believes it has approximately a 65% chance of occurring.",
          "Vault Markets uses a pari-mutuel system: all bets are pooled together, and winners share the total pool proportionally. Your payout depends on how much you bet relative to the total winning pool at settlement, not the percentage shown when you placed your bet.",
        ],
        icon: Scale,
      },
      {
        question: "Why do I need to tweet my prediction?",
        answer: [
          "The tweet verification system serves multiple purposes: it creates a public, timestamped record of your prediction that can't be altered after the fact.",
          "It also adds a social element to prediction markets, allowing you to share your insights with followers and potentially earn recognition for accurate predictions. Your tweet is automatically verified by our system before your bet is confirmed.",
        ],
        icon: Twitter,
      },
      {
        question: "Can I bet on both outcomes?",
        answer: "Yes, you can hold positions on multiple outcomes in the same market. Some traders do this to hedge their bets or to take advantage of price movements. However, keep in mind that betting equal amounts on both sides of a binary market will result in a small loss due to the spread.",
        icon: Scale,
      },
    ],
  },
  {
    title: "Market Mechanics",
    items: [
      {
        question: "How are odds calculated?",
        answer: [
          "Vault Markets uses a pari-mutuel betting system. This means odds are determined by the total amount bet on each outcome, not by a bookmaker.",
          "As more people bet on an outcome, its price increases (and potential payout decreases). Conversely, outcomes with fewer bets offer higher potential returns. This creates a dynamic, market-driven pricing mechanism.",
        ],
        icon: TrendingUp,
      },
      {
        question: "What is the pool and how does it work?",
        answer: [
          "The pool represents the total amount of virtual credits bet on a market across all outcomes. When a market resolves, the pool is distributed among winning bettors proportionally to their stake.",
          "A small platform fee (typically 1%) is deducted from the pool before distribution. This fee helps maintain the platform and fund future development.",
        ],
        icon: Coins,
      },
      {
        question: "What happens if a market is cancelled?",
        answer: "In rare cases, a market may be cancelled if the underlying event is cancelled, postponed indefinitely, or if there's ambiguity about the outcome. When this happens, all bets are refunded to participants at their original amounts.",
        icon: Shield,
      },
    ],
  },
  {
    title: "Market Lifecycle",
    items: [
      {
        question: "What are the different market states?",
        answer: [
          "Markets progress through several states: Draft (being created), Published (visible but not yet open), Open (accepting bets), Closed (no more bets accepted), Resolved (outcome determined), and Settled (payouts distributed).",
          "You can only place bets when a market is in the 'Open' state. The market timeline on each market page shows the current state and important dates.",
        ],
        icon: Clock,
      },
      {
        question: "When does a market close?",
        answer: "Each market has a specified closing time, typically set before the event outcome could be known. After this time, no new bets are accepted. The closing time is always displayed on the market page so you know exactly how long you have to participate.",
        icon: Clock,
      },
      {
        question: "How is a market resolved?",
        answer: [
          "After the real-world event concludes, administrators determine the winning outcome based on official sources. The resolution source (when available) is linked on the market page for transparency.",
          "Resolution typically occurs within 24-48 hours of the event conclusion, though some markets may take longer if the outcome requires verification.",
        ],
        icon: Shield,
      },
      {
        question: "How are payouts calculated?",
        answer: [
          "When a market resolves, the total pool (minus the platform fee) is distributed to winners. Your payout is proportional to your share of the winning pool.",
          "For example, if you bet $100 on the winning outcome and that outcome's total pool is $1,000, you own 10% of the winning pool. If the total market pool is $2,000 and the fee is 1%, you'd receive 10% of $1,980 = $198.",
        ],
        icon: Coins,
      },
    ],
  },
  {
    title: "Your Account",
    items: [
      {
        question: "What is my balance?",
        answer: "Your balance represents your virtual credits available for betting. New users start with $10,000. Your balance increases when you win bets and decreases when you place bets or lose. You can view your current balance in the header after signing in.",
        icon: Coins,
      },
      {
        question: "Can I see my betting history?",
        answer: "Yes! Visit your profile page to see all your past and current bets, including the markets you've participated in, your positions, and your overall performance statistics.",
        icon: Users,
      },
      {
        question: "What is the leaderboard?",
        answer: "The leaderboard ranks all users by their current balance. It's a way to see how your prediction skills stack up against other traders. Top performers are highlighted with special badges.",
        icon: Award,
      },
      {
        question: "How do referrals work?",
        answer: [
          "Each user has a unique referral code that can be shared with friends. When someone signs up using your referral code, both you and the new user may receive bonus credits or raffle entries.",
          "Referral bonuses are typically awarded after the referred user places their first verified bet.",
        ],
        icon: Users,
      },
    ],
  },
  {
    title: "Trust & Safety",
    items: [
      {
        question: "Is my data secure?",
        answer: "We take security seriously. Authentication is handled through Privy, a trusted Web3 authentication provider. We only store the minimum necessary information to operate your account. Your X login credentials are never shared with us.",
        icon: Shield,
      },
      {
        question: "How do you prevent manipulation?",
        answer: [
          "The tweet verification system creates a public, immutable record of predictions. This transparency makes it difficult for bad actors to manipulate outcomes or claim false predictions.",
          "Additionally, our pari-mutuel system means that large bets automatically adjust the odds, making manipulation expensive and self-defeating.",
        ],
        icon: Shield,
      },
      {
        question: "What if I have a dispute?",
        answer: "If you believe a market was resolved incorrectly or have concerns about any aspect of the platform, please reach out to our support team. We review all disputes carefully and prioritize fair resolution for all participants.",
        icon: HelpCircle,
      },
    ],
  },
];

function FAQItemComponent({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const Icon = item.icon;
  const answers = Array.isArray(item.answer) ? item.answer : [item.answer];

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 py-4 text-left hover:bg-muted/30 transition-colors px-4 -mx-4 rounded-lg"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="flex-1 font-medium">{item.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 pl-14 pr-4 space-y-3">
              {answers.map((paragraph, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQContent() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <motion.div
      className="max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4"
        >
          <HelpCircle className="h-8 w-8 text-primary" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-bold mb-3"
        >
          Frequently Asked Questions
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground max-w-lg mx-auto"
        >
          Everything you need to know about prediction markets and how Vault Markets works.
        </motion.p>
      </div>

      {/* FAQ Categories */}
      <div className="space-y-8">
        {faqCategories.map((category, categoryIndex) => (
          <motion.div
            key={category.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + categoryIndex * 0.05 }}
          >
            <h2 className="text-lg font-semibold mb-4 text-primary">{category.title}</h2>
            <GlassCard>
              <GlassCardContent className="pt-4 pb-0">
                {category.items.map((item, itemIndex) => {
                  const itemId = `${categoryIndex}-${itemIndex}`;
                  return (
                    <FAQItemComponent
                      key={itemId}
                      item={item}
                      isOpen={openItems.has(itemId)}
                      onToggle={() => toggleItem(itemId)}
                    />
                  );
                })}
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Contact section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center"
      >
        <GlassCard>
          <GlassCardContent className="py-8">
            <h3 className="text-lg font-semibold mb-2">Still have questions?</h3>
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? Reach out and we'll help you out.
            </p>
            <a
              href="https://twitter.com/vault777"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Twitter className="h-4 w-4" />
              Contact us on X
            </a>
          </GlassCardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
