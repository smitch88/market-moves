import { Header } from "@/components/layout/header";
import { GlassCard, GlassCardContent, GlassCardHeader } from "@vault/ui";

export const metadata = {
  title: "Terms of Service | Vault Markets",
  description: "Terms of Service for Vault Markets prediction platform",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <GlassCard>
          <GlassCardHeader>
            <h1 className="text-3xl font-bold">Terms of Service</h1>
            <p className="text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </GlassCardHeader>
          <GlassCardContent className="prose prose-neutral dark:prose-invert max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Vault Markets ("the Platform"), you agree to be bound by these 
              Terms of Service. If you do not agree to these terms, please do not use the Platform.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Vault Markets is a prediction market platform that allows users to make predictions 
              on real-world events using virtual currency. The Platform is for entertainment and 
              informational purposes only.
            </p>

            <h2>3. Virtual Currency</h2>
            <p>
              All balances and transactions on the Platform use virtual currency with no real-world 
              monetary value. Virtual currency cannot be exchanged, transferred, or redeemed for 
              real money, goods, or services.
            </p>

            <h2>4. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. 
              You agree to notify us immediately of any unauthorized use of your account.
            </p>

            <h2>5. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Platform for any illegal purpose</li>
              <li>Attempt to manipulate markets or outcomes</li>
              <li>Create multiple accounts</li>
              <li>Use automated systems to interact with the Platform</li>
              <li>Interfere with the proper operation of the Platform</li>
            </ul>

            <h2>6. Intellectual Property</h2>
            <p>
              All content on the Platform, including text, graphics, logos, and software, is the 
              property of Vault777 and is protected by intellectual property laws.
            </p>

            <h2>7. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided "as is" without warranties of any kind. We do not guarantee 
              the accuracy of market information or predictions.
            </p>

            <h2>8. Limitation of Liability</h2>
            <p>
              Vault777 shall not be liable for any indirect, incidental, special, or consequential 
              damages arising from your use of the Platform.
            </p>

            <h2>9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the Platform 
              after changes constitutes acceptance of the modified terms.
            </p>

            <h2>10. Contact</h2>
            <p>
              For questions about these Terms, please contact us through our official channels.
            </p>
          </GlassCardContent>
        </GlassCard>
      </main>
    </div>
  );
}
