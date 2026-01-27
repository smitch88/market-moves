import { Header } from "@/components/layout/header";
import { GlassCard, GlassCardContent, GlassCardHeader } from "@vault/ui";

export const metadata = {
  title: "Privacy Policy | Vault Markets",
  description: "Privacy Policy for Vault Markets prediction platform",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <GlassCard>
          <GlassCardHeader>
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </GlassCardHeader>
          <GlassCardContent className="prose prose-neutral dark:prose-invert max-w-none">
            <h2>1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul>
              <li>Account information (email, username, profile picture)</li>
              <li>Social login data (when using X/Twitter authentication)</li>
              <li>Transaction and activity data on the Platform</li>
              <li>Communications you send to us</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve the Platform</li>
              <li>Process transactions and maintain your account</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Detect and prevent fraud and abuse</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>
              We do not sell your personal information. We may share information with:
            </p>
            <ul>
              <li>Service providers who assist in operating the Platform</li>
              <li>Law enforcement when required by law</li>
              <li>Other users (limited to public profile information)</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your information. However, 
              no method of transmission over the Internet is 100% secure.
            </p>

            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your account</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h2>6. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session, remember your 
              preferences, and analyze Platform usage.
            </p>

            <h2>7. Third-Party Services</h2>
            <p>
              The Platform may contain links to third-party services. We are not responsible 
              for the privacy practices of these services.
            </p>

            <h2>8. Children's Privacy</h2>
            <p>
              The Platform is not intended for users under 18 years of age. We do not knowingly 
              collect information from children.
            </p>

            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any 
              changes by posting the new policy on this page.
            </p>

            <h2>10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us through our 
              official channels.
            </p>
          </GlassCardContent>
        </GlassCard>
      </main>
    </div>
  );
}
