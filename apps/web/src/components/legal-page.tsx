import { Link } from "react-router";

export type LegalDocument = "privacy" | "terms";

type LegalPageProps = {
  document: LegalDocument;
};

const COPY: Record<
  LegalDocument,
  {
    title: string;
    kicker: string;
    summary: string;
    sections: { heading: string; paragraphs: string[] }[];
  }
> = {
  privacy: {
    title: "Privacy policy",
    kicker: "Legal / privacy",
    summary:
      "This is a draft placeholder for Numra’s privacy policy. It describes, at a high level, how we intend to handle personal and financial data once the product is generally available.",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Account details you provide when you sign up, such as your name and email address.",
          "Bank connection metadata and transaction data synced from linked institutions so we can show balances, spending, and history in Numra.",
          "Basic technical logs needed to keep the service secure and reliable.",
        ],
      },
      {
        heading: "How we use data",
        paragraphs: [
          "To operate your Numra workspace: authentication, connected accounts, and the personal finance views you see in the app.",
          "To maintain and improve the product, including diagnosing errors and preventing abuse.",
          "We do not sell your personal information.",
        ],
      },
      {
        heading: "Sharing",
        paragraphs: [
          "We use infrastructure and banking connectivity providers strictly to deliver the service (for example hosting and regulated bank-connection partners).",
          "We may disclose information if required by law or to protect the security of Numra and its users.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          "You can disconnect a bank connection from the app and request account deletion by contacting us.",
          "This draft will be replaced with a full policy before public launch.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    kicker: "Legal / terms",
    summary:
      "This is a draft placeholder for Numra’s terms of use. It outlines the basic rules for using the product while it is in early access.",
    sections: [
      {
        heading: "Early access",
        paragraphs: [
          "Numra is provided as an early / alpha product. Features may change, break, or be removed without notice.",
          "Do not rely on Numra as your only record of balances, payments, or tax-related information.",
        ],
      },
      {
        heading: "Your account",
        paragraphs: [
          "You are responsible for keeping your login credentials secure and for activity under your account.",
          "Access may be limited to invited or allowlisted users during early access.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "Use Numra only for lawful personal finance management.",
          "Do not attempt to disrupt the service, probe other users’ data, or misuse bank-connectivity flows.",
        ],
      },
      {
        heading: "No warranties",
        paragraphs: [
          "The service is provided “as is” without warranties of any kind to the fullest extent permitted by law.",
          "These draft terms will be replaced with a full agreement before public launch.",
        ],
      },
    ],
  },
};

export function LegalPage(props: LegalPageProps) {
  const copy = COPY[props.document];
  const updated = "25 July 2026";

  return (
    <article className="mx-auto max-w-3xl pt-4">
      <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-[var(--blue)] uppercase">
        {copy.kicker}
      </p>
      <h1 className="text-4xl font-black tracking-[-0.04em] uppercase sm:text-5xl">{copy.title}</h1>
      <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
        Draft · Last updated {updated}
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
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 border-t border-[var(--rule)] pt-6 text-sm text-[var(--muted)]">
        Questions about this draft?{" "}
        <Link className="focus-ring text-[var(--blue)] underline-offset-4 hover:underline" to="/">
          Back to Numra
        </Link>
      </p>
    </article>
  );
}
