import { Link } from "react-router";

import { site } from "../lib/site.ts";

export type LegalDocument = "privacy" | "terms";

type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalPageProps = {
  document: LegalDocument;
};

const OPERATOR = site.operatorName;
const CONTACT_EMAIL = site.contactEmail;
const SERVICE_URL = site.serviceUrl;
const LAST_UPDATED = "26 July 2026";

const COPY: Record<
  LegalDocument,
  {
    title: string;
    kicker: string;
    summary: string;
    sections: LegalSection[];
  }
> = {
  privacy: {
    title: "Privacy policy",
    kicker: "Legal / privacy",
    summary: `This privacy policy explains how ${OPERATOR} (“I”, “me”, “operator”) collects, uses, stores, and shares personal data when you use Numra at ${SERVICE_URL}. Numra is a self-hosted personal finance application. Access is limited to email addresses I explicitly allowlist. This policy is intended to meet transparency requirements under the EU General Data Protection Regulation (GDPR) and related Polish data-protection law.`,
    sections: [
      {
        heading: "1. Data controller",
        paragraphs: [
          `The data controller for Numra is ${OPERATOR}.`,
          `Contact for privacy requests: ${CONTACT_EMAIL}.`,
          `Service address: ${SERVICE_URL}.`,
        ],
      },
      {
        heading: "2. Who this policy applies to",
        paragraphs: [
          "Numra is not a public sign-up product. Only people whose email addresses have been added to the allowlist can create an account or sign in.",
          "If you are an allowlisted user, this policy describes how your personal data is processed when you use the service. If you are the operator using Numra for your own finances, the same technical processing described here applies to your account data.",
        ],
      },
      {
        heading: "3. Personal data we process",
        paragraphs: [
          "Depending on how you use Numra, I may process the following categories of personal data:",
        ],
        bullets: [
          "Account data: name, email address, and a hashed password.",
          "Authentication and session data: session tokens, session expiry, IP address, and user agent.",
          "Access-control data: whether your email is on the allowlist and any internal note associated with that allowlist entry.",
          "Bank-connection data obtained after you consent through Enable Banking: linked institution name and country, connection status, consent/session validity, and sync status or error messages.",
          "Account and transaction data retrieved from your bank via Enable Banking’s account information services, such as account name, currency, IBAN or other account identifiers, balances where provided by the bank interface, booking/value dates, amounts, descriptions, and counterparty names.",
          "Technical and security data: application logs and error reports needed to operate and secure the service (including error diagnostics via Sentry, where configured).",
        ],
      },
      {
        heading: "4. Bank data and open banking",
        paragraphs: [
          "Numra connects to banks and other account-servicing payment service providers through Enable Banking, a third-party account information service provider.",
          "Bank access happens only after you start a connection in Numra and complete the bank’s consent flow. Numra uses this access to retrieve account information and transaction history so it can show balances, spending, and history in the app.",
          "Numra is designed for read-oriented account information use. It is not a bank, payment institution, or money-transmission service, and it is not intended to initiate payments from your bank account.",
          "Enable Banking session identifiers used to refresh your linked data are stored encrypted at rest. Numra stores a local copy of connected accounts and transactions in its database so the app can be used without calling your bank on every page load. Data is refreshed periodically while a valid bank consent/session exists.",
          "Your bank and Enable Banking process data under their own terms and privacy notices when you authorise the connection. You should review those notices during the consent flow.",
        ],
      },
      {
        heading: "5. Purposes of processing",
        paragraphs: ["Personal data is processed only as needed to:"],
        bullets: [
          "Create and secure your Numra account and keep you signed in.",
          "Enforce allowlist-based access control.",
          "Establish, maintain, refresh, and revoke bank connections you authorise.",
          "Import, store, and display your financial accounts and transactions in Numra.",
          "Maintain, troubleshoot, protect, and improve the reliability and security of the service.",
          "Respond to your requests (for example access, correction, or deletion).",
          "Comply with legal obligations where they apply.",
        ],
      },
      {
        heading: "6. Legal bases (GDPR)",
        paragraphs: ["Where GDPR applies, processing is based on:"],
        bullets: [
          "Article 6(1)(b) — performance of a contract / steps at your request: operating your account and providing the Numra service you chose to use.",
          "Article 6(1)(a) — consent: accessing your bank account information through Enable Banking after you authorise the connection at your bank. You may withdraw bank consent by revoking access at your bank and/or asking me to remove the connection and related data from Numra.",
          "Article 6(1)(f) — legitimate interests: securing the service, preventing abuse, diagnosing errors, and operating a private allowlisted deployment in a stable way. These interests are balanced against your rights and expectations.",
          "Article 6(1)(c) — legal obligation: where processing is required to comply with applicable law.",
        ],
      },
      {
        heading: "7. Cookies and similar technologies",
        paragraphs: [
          "Numra uses cookies or similar browser storage as needed for authentication and to keep you signed in. These are essential to operate the logged-in service.",
          "Numra does not use third-party advertising cookies. If additional analytics or non-essential cookies are introduced later, this policy will be updated before they are used.",
        ],
      },
      {
        heading: "8. Sharing and processors",
        paragraphs: [
          "I do not sell your personal data. I do not share it for advertising.",
          "Data may be processed by service providers acting on my instructions, or by infrastructure needed to run Numra, including:",
        ],
        bullets: [
          "Cloudflare — hosting, content delivery, and related cloud infrastructure for the application and API.",
          "Enable Banking — regulated/bank-connectivity intermediary used to obtain account information you authorise.",
          "Sentry — error and performance monitoring, if enabled in the deployed environment.",
          "Your bank or ASPSP — when you complete the consent flow to link an account.",
        ],
      },
      {
        heading: "9. International transfers",
        paragraphs: [
          "Numra may be hosted on infrastructure that processes data in the European Economic Area and/or other countries where the providers above operate.",
          "Where personal data is transferred outside the EEA, I rely on appropriate safeguards recognised under GDPR where required (for example the provider’s Standard Contractual Clauses or equivalent transfer mechanism).",
        ],
      },
      {
        heading: "10. Retention",
        paragraphs: [
          "I keep personal data only as long as needed for the purposes above, including secure operation of the allowlisted deployment:",
        ],
        bullets: [
          "Account and profile data: for as long as your account remains enabled on the allowlist, and for a short period afterwards if needed to complete deletion or resolve security issues.",
          "Sessions: until they expire or you sign out; expired sessions are removed as part of normal auth lifecycle handling.",
          "Bank connections, accounts, and transactions: while the connection/account is linked to your Numra account and needed to provide the ledger views. If you disconnect a bank or request deletion, related bank-derived data is deleted from Numra within a reasonable period, except where a limited residual copy is temporarily required for security, backup rotation, or legal reasons.",
          "Logs and error reports: for a limited operational period appropriate to debugging and security, then deleted or irreversibly aggregated.",
        ],
      },
      {
        heading: "11. Security",
        paragraphs: [
          "I apply technical and organisational measures appropriate to a small self-hosted financial-data application. These include access restricted by allowlist, authenticated sessions, encrypted storage of sensitive bank session identifiers, transport encryption (HTTPS), and least-privilege handling of secrets in the hosting environment.",
          "No method of transmission or storage is completely secure. You should use a strong unique password and protect devices you use to access Numra.",
        ],
      },
      {
        heading: "12. Your rights",
        paragraphs: [
          "If GDPR applies to you, you may have the right to request access, rectification, erasure, restriction of processing, data portability, and to object to processing based on legitimate interests. Where processing is based on consent (including bank account access), you may withdraw consent at any time without affecting the lawfulness of processing before withdrawal.",
          `To exercise these rights, email ${CONTACT_EMAIL}. I may need to verify your identity before fulfilling a request.`,
          "You also have the right to lodge a complaint with a supervisory authority. In Poland, this is the President of the Personal Data Protection Office (UODO). You may also contact the authority in your EU/EEA country of residence.",
        ],
      },
      {
        heading: "13. Children",
        paragraphs: [
          "Numra is intended for adults. It is not directed at children under 18, and I do not knowingly allowlist or collect data from children.",
        ],
      },
      {
        heading: "14. Changes to this policy",
        paragraphs: [
          "I may update this privacy policy from time to time, for example when features, providers, or legal requirements change. The “Last updated” date at the top of this page will be revised when changes are published.",
          "Material changes affecting allowlisted users will be communicated in a reasonable way when practical (for example by email or a notice in the app).",
        ],
      },
      {
        heading: "15. Contact",
        paragraphs: [
          `Questions about this privacy policy or Numra’s data practices: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    kicker: "Legal / terms",
    summary: `These terms of use govern access to and use of Numra, a self-hosted personal finance application operated by ${OPERATOR} (“I”, “me”, “operator”) at ${SERVICE_URL}. By creating an account, signing in, or using Numra, you agree to these terms. If you do not agree, do not use the service.`,
    sections: [
      {
        heading: "1. The service",
        paragraphs: [
          "Numra helps allowlisted users view personal finance information in one place, including balances, accounts, and transactions imported from linked bank institutions.",
          "Numra is private software operated for personal / invited use. It is not offered as a public commercial banking product, payment service, investment service, or regulated consumer financial account.",
          "Features may change, break, or be withdrawn as the software evolves.",
        ],
      },
      {
        heading: "2. Operator and contact",
        paragraphs: [
          `Operator: ${OPERATOR}.`,
          `Contact: ${CONTACT_EMAIL}.`,
          `Service: ${SERVICE_URL}.`,
        ],
      },
      {
        heading: "3. Eligibility and allowlist",
        paragraphs: [
          "Access to Numra is restricted. You may use the service only if I have added your email address to the allowlist and you create an account with that email.",
          "I may add or remove allowlist entries at my discretion, including suspending or ending access without notice where needed for security, misuse, or operational reasons.",
          "You must be at least 18 years old and capable of entering into these terms.",
        ],
      },
      {
        heading: "4. Your account",
        paragraphs: [
          "You must provide accurate registration details and keep your password confidential. You are responsible for activity under your account.",
          "Notify me promptly at the contact email above if you believe your account has been compromised.",
          "You may not share your login credentials or attempt to access another person’s account or data.",
        ],
      },
      {
        heading: "5. Bank connections",
        paragraphs: [
          "Optional bank linking is provided through Enable Banking and your selected bank or account-servicing institution.",
          "By starting a bank connection, you instruct Numra to redirect you to complete the institution’s authorisation/consent process and, if consent is granted, to retrieve account information and transactions for display and storage in Numra.",
          "You are responsible for reviewing and accepting your bank’s and Enable Banking’s terms, notices, and consent screens. Bank availability, data quality, consent duration, and reconnect requirements depend on those parties and may change.",
          "Numra stores connection metadata and a local ledger copy of accounts/transactions and may refresh that copy while consent remains valid. Revoking consent at your bank, letting consent expire, or asking me to remove a connection will limit or stop further retrieval; already-stored data is handled as described in the privacy policy.",
          "You must only link accounts you are authorised to access.",
        ],
      },
      {
        heading: "6. No professional advice; not a bank",
        paragraphs: [
          "Numra is an information and organisation tool only. Nothing in the service is financial, investment, tax, accounting, or legal advice.",
          "Displayed balances and transactions may be incomplete, delayed, or incorrect because of bank feed limitations, sync timing, or software defects. Do not rely on Numra as your sole record for payments, tax filings, or financial decisions.",
          "Numra is not a bank, credit institution, payment service provider, account information service provider facing the public, or electronic money issuer. Linking a bank does not create a banking relationship with me.",
        ],
      },
      {
        heading: "7. Acceptable use",
        paragraphs: [
          "You agree to use Numra only for lawful personal finance management and not to:",
        ],
        bullets: [
          "Probe, scan, reverse engineer, or disrupt the service, its hosting, or other users’ data except to the extent such restriction is prohibited by law.",
          "Circumvent the allowlist, authentication, or bank-consent flows.",
          "Upload malicious code or attempt unauthorised access to systems or data.",
          "Use the service for fraud, money laundering, or any illegal activity.",
          "Misrepresent your identity or your authority over a linked bank account.",
        ],
      },
      {
        heading: "8. Intellectual property",
        paragraphs: [
          "The Numra name, branding, and software are owned by the operator or respective rights holders. These terms do not transfer ownership of the software to you.",
          "Subject to these terms and your allowlisted access, you receive a limited, revocable, non-exclusive right to use the hosted service for your own personal purposes.",
          "You retain your rights in your own account content and bank-derived data. You grant me a limited right to host, process, and display that data solely to operate Numra for you.",
        ],
      },
      {
        heading: "9. Availability and changes",
        paragraphs: [
          "I aim to keep Numra available but do not guarantee uninterrupted or error-free operation. Maintenance, hosting issues, provider outages (including Cloudflare, Enable Banking, or banks), or software updates may cause downtime or data delays.",
          "I may modify, suspend, or discontinue features or the entire service at any time.",
        ],
      },
      {
        heading: "10. Disclaimer of warranties",
        paragraphs: [
          "To the fullest extent permitted by applicable law, Numra is provided “as is” and “as available”, without warranties of any kind, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
          "I do not warrant that bank data will be accurate, complete, current, or continuously available.",
        ],
      },
      {
        heading: "11. Limitation of liability",
        paragraphs: [
          "To the fullest extent permitted by applicable law, I am not liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost data, business interruption, or inaccurate financial information arising from your use of Numra or inability to use it.",
          "To the fullest extent permitted by law, my aggregate liability arising out of or relating to the service or these terms is limited to PLN 0 if you pay nothing for the service, or to the amount you paid me for the service in the 12 months before the claim if any fee was charged.",
          "Nothing in these terms excludes or limits liability that cannot be excluded or limited under applicable law, including liability for death or personal injury caused by negligence, or for fraud or fraudulent misrepresentation.",
        ],
      },
      {
        heading: "12. Indemnity",
        paragraphs: [
          "You agree to indemnify and hold me harmless from claims, losses, and expenses (including reasonable legal fees) arising out of your misuse of Numra, your breach of these terms, or your linking of accounts you are not authorised to access, to the extent permitted by law.",
        ],
      },
      {
        heading: "13. Suspension and termination",
        paragraphs: [
          "You may stop using Numra at any time and may request account deletion by emailing the contact address above.",
          "I may suspend or terminate your access immediately if you breach these terms, if your email is removed from the allowlist, or if continued operation would create security, legal, or operational risk.",
          "On termination, your right to access the service ends. Data handling after termination follows the privacy policy.",
        ],
      },
      {
        heading: "14. Privacy",
        paragraphs: [
          "Personal data is handled as described in the Numra privacy policy available at /privacy on this site. The privacy policy forms part of how the service is operated alongside these terms.",
        ],
      },
      {
        heading: "15. Changes to these terms",
        paragraphs: [
          "I may update these terms from time to time. The “Last updated” date will change when a new version is published. Continued use after an update constitutes acceptance of the revised terms, except where applicable law requires a different process.",
        ],
      },
      {
        heading: "16. Governing law and disputes",
        paragraphs: [
          "These terms are governed by the laws of Poland, without regard to conflict-of-law rules that would require another jurisdiction’s law.",
          "Courts of Poland shall have jurisdiction over disputes arising out of or relating to these terms or Numra, subject to any mandatory consumer protection rules that apply if you are a consumer resident elsewhere in the EU/EEA.",
        ],
      },
      {
        heading: "17. Contact",
        paragraphs: [`Questions about these terms: ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export function LegalPage(props: LegalPageProps) {
  const copy = COPY[props.document];

  return (
    <article className="mx-auto max-w-3xl pt-4">
      <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-[var(--blue)] uppercase">
        {copy.kicker}
      </p>
      <h1 className="text-4xl font-black tracking-[-0.04em] uppercase sm:text-5xl">{copy.title}</h1>
      <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
        Last updated {LAST_UPDATED}
      </p>
      <p className="mt-6 text-lg leading-7 text-[var(--soft-ink)]">{copy.summary}</p>

      <div className="mt-10 space-y-8">
        {copy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-black tracking-[-0.03em]">{section.heading}</h2>
            <div className="mt-3 space-y-3 text-[var(--soft-ink)]">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-7">
                  {paragraph}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 leading-7">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 border-t border-[var(--rule)] pt-6 text-sm text-[var(--muted)]">
        Questions? Email{" "}
        <a
          className="focus-ring text-[var(--blue)] underline-offset-4 hover:underline"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
        {" · "}
        <Link className="focus-ring text-[var(--blue)] underline-offset-4 hover:underline" to="/">
          Back to Numra
        </Link>
      </p>
    </article>
  );
}
