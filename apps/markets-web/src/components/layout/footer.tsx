"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="border-t border-border/40 bg-background/50 backdrop-blur-sm mt-12"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-4">
          {/* Legal Links */}
          <nav className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <Link 
              href="/faq" 
              className="hover:text-foreground transition-colors"
            >
              FAQ
            </Link>
            <span className="text-border">|</span>
            <a 
              href="https://www.vault777.com/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
            <span className="text-border">|</span>
            <a 
              href="https://www.vault777.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-border">|</span>
            <a 
              href="https://www.vault777.com/responsible-gaming" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Responsible Gaming
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground/70">
            © {currentYear} Vault777. All rights reserved.
          </p>
        </div>
      </div>
    </motion.footer>
  );
}
