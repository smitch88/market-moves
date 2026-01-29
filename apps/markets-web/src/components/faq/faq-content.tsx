"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string | string[];
}

const faqCategories: { title: string; items: FAQItem[] }[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is a prediction market?",
        answer: [
          "A prediction market is a platform where you can buy and sell shares in the outcome of future events. Vault Markets uses an Automated Market Maker (AMM) that provides instant liquidity for trading.",
          "Each market poses a question with two possible outcomes. The price shown for each outcome reflects the market's implied probability—a higher price means the market believes that outcome is more likely.",
        ],
      },
      {
        question: "How do I get started?",
        answer: [
          "Sign in with your X (Twitter) account to create your Vault Markets profile. You'll receive a starting balance of $10,000 in virtual credits to begin trading.",
          "Browse available markets, find one that interests you, select your predicted outcome, and place your bet. It's that simple!",
        ],
      },
      {
        question: "Is this real money?",
        answer: "No. Vault Markets uses virtual credits for entertainment and educational purposes. Your starting balance and all winnings are virtual currency that cannot be withdrawn or exchanged for real money. This allows you to experience the excitement of prediction markets without financial risk.",
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
      },
      {
        question: "What do the percentages mean?",
        answer: [
          "Percentages represent the current implied probability of each outcome based on the market's trading activity. If an outcome shows 65%, the market collectively believes it has approximately a 65% chance of occurring.",
          "Vault Markets uses an Automated Market Maker (AMM): prices adjust automatically as people buy and sell shares. When you buy shares, the price goes up. When you sell, the price goes down. Each winning share pays out $1 at settlement.",
        ],
      },
      {
        question: "Why do I need to tweet my prediction?",
        answer: [
          "The tweet verification system serves multiple purposes: it creates a public, timestamped record of your prediction that can't be altered after the fact.",
          "It also adds a social element to prediction markets, allowing you to share your insights with followers and potentially earn recognition for accurate predictions. Your tweet is automatically verified by our system before your bet is confirmed.",
        ],
      },
      {
        question: "Can I bet on both outcomes?",
        answer: "Yes, you can hold positions on multiple outcomes in the same market. Some traders do this to hedge their bets or to take advantage of price movements. However, keep in mind that betting equal amounts on both sides of a binary market will result in a small loss due to the spread.",
      },
    ],
  },
  {
    title: "Market Mechanics",
    items: [
      {
        question: "How are odds calculated?",
        answer: [
          "Vault Markets uses an Automated Market Maker (AMM) with a constant product formula. This means prices are determined automatically based on supply and demand, not by a bookmaker.",
          "As more people buy shares of an outcome, its price increases (and potential payout decreases). Conversely, outcomes with fewer buyers offer lower prices and higher potential returns. Each winning share pays out $1 at settlement.",
        ],
      },
      {
        question: "What is the pool and how does it work?",
        answer: [
          "The market maintains liquidity reserves that allow for instant trading. When you buy shares, you're purchasing from this pool. When you sell, you're selling back to the pool.",
          "A small platform fee (typically 1%) is applied to trades. This fee helps maintain the platform and fund future development. At settlement, winning shares pay out $1 each (minus fees).",
        ],
      },
      {
        question: "What happens if a market is cancelled?",
        answer: "In rare cases, a market may be cancelled if the underlying event is cancelled, postponed indefinitely, or if there's ambiguity about the outcome. When this happens, all bets are refunded to participants at their original amounts.",
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
      },
      {
        question: "When does a market close?",
        answer: "Each market has a specified closing time, typically set before the event outcome could be known. After this time, no new bets are accepted. The closing time is always displayed on the market page so you know exactly how long you have to participate.",
      },
      {
        question: "How is a market resolved?",
        answer: [
          "After the real-world event concludes, administrators determine the winning outcome based on official sources. The resolution source (when available) is linked on the market page for transparency.",
          "Resolution typically occurs within 24-48 hours of the event conclusion, though some markets may take longer if the outcome requires verification.",
        ],
      },
      {
        question: "How are payouts calculated?",
        answer: [
          "When a market resolves, the total pool (minus the platform fee) is distributed to winners. Your payout is proportional to your share of the winning pool.",
          "For example, if you bet $100 on the winning outcome and that outcome's total pool is $1,000, you own 10% of the winning pool. If the total market pool is $2,000 and the fee is 1%, you'd receive 10% of $1,980 = $198.",
        ],
      },
    ],
  },
  {
    title: "Your Account",
    items: [
      {
        question: "What is my balance?",
        answer: "Your balance represents your virtual credits available for betting. New users start with $10,000. Your balance increases when you win bets and decreases when you place bets or lose. You can view your current balance in the header after signing in.",
      },
      {
        question: "Can I see my betting history?",
        answer: "Yes! Visit your profile page to see all your past and current bets, including the markets you've participated in, your positions, and your overall performance statistics.",
      },
      {
        question: "What is the leaderboard?",
        answer: "The leaderboard ranks all users by their current balance. It's a way to see how your prediction skills stack up against other traders. Top performers are highlighted with special badges.",
      },
      {
        question: "How do referrals work?",
        answer: [
          "Each user has a unique referral code that can be shared with friends. When someone signs up using your referral code, both you and the new user may receive bonus credits or raffle entries.",
          "Referral bonuses are typically awarded after the referred user places their first verified bet.",
        ],
      },
    ],
  },
  {
    title: "Trust & Safety",
    items: [
      {
        question: "Is my data secure?",
        answer: "We take security seriously. Authentication is handled through Privy, a trusted Web3 authentication provider. We only store the minimum necessary information to operate your account. Your X login credentials are never shared with us.",
      },
      {
        question: "How do you prevent manipulation?",
        answer: [
          "The tweet verification system creates a public, immutable record of predictions. This transparency makes it difficult for bad actors to manipulate outcomes or claim false predictions.",
          "Additionally, our AMM system means that large trades automatically adjust the prices, making manipulation expensive and self-defeating.",
        ],
      },
      {
        question: "What if I have a dispute?",
        answer: "If you believe a market was resolved incorrectly or have concerns about any aspect of the platform, please reach out to our support team. We review all disputes carefully and prioritize fair resolution for all participants.",
      },
    ],
  },
];

function FAQItemComponent({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const answers = Array.isArray(item.answer) ? item.answer : [item.answer];

  return (
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left hover:text-primary transition-colors group"
      >
        <span className="font-medium text-[15px]">{item.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 space-y-3 text-[15px] text-muted-foreground leading-relaxed">
              {answers.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-3">Frequently Asked Questions</h1>
        <p className="text-muted-foreground text-lg">
          Everything you need to know about prediction markets and how Vault Markets works.
        </p>
      </div>

      {/* FAQ Categories */}
      <div className="space-y-8">
        {faqCategories.map((category, categoryIndex) => (
          <div key={category.title}>
            <h2 className="text-xl font-bold mb-4">{category.title}</h2>
            <div className="rounded-xl bg-card/60 backdrop-blur-sm border border-border/40 p-6">
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
            </div>
          </div>
        ))}
      </div>

      {/* Contact section */}
      <div className="mt-12 rounded-xl bg-card/60 backdrop-blur-sm border border-border/40 p-8 text-center">
        <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
        <p className="text-muted-foreground mb-6">
          Can't find what you're looking for? Reach out and we'll help you out.
        </p>
        <a
          href="https://twitter.com/vault777"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Contact us on X
        </a>
      </div>
    </div>
  );
}
