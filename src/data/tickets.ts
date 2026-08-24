import type { Ticket } from "@/lib/types";

export const tickets: Ticket[] = [
  {
    id: "t-001",
    title: "Unexpected invoice line",
    category: "billing",
    customerMessage:
      "I was charged $42 this month but expected the Launch plan minimum. Can you explain the invoice?",
    accountContext:
      "Plan: Launch. Active projects: 3. Storage: 2.1 GB. Compute usage: 38 CU-hours at 0.25 CU average.",
    policyNotes:
      "Explain compute and storage separately. Do not issue credits without billing review.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only", "issue_credit"],
      mustMention: ["storage"],
      mustNotMention: ["full refund approved"],
    },
  },
  {
    id: "t-002",
    title: "Password reset loop",
    category: "access",
    customerMessage:
      "I keep getting invalid password errors after resetting through email. I need access today.",
    accountContext:
      "User verified. Last login 3 days ago. SSO not enabled. No security holds.",
    policyNotes: "Offer password reset guidance. Escalate only if account lock persists after reset.",
    expected: {
      classification: "access",
      escalate: false,
      allowedActions: ["reply_only", "reset_password"],
      mustMention: ["reset"],
    },
  },
  {
    id: "t-003",
    title: "Refund after annual prepay",
    category: "refund",
    customerMessage:
      "We prepaid annually but are shutting down next week. Please refund the unused months.",
    accountContext:
      "Billing cycle: annual prepaid. Usage: low. Contract started 45 days ago.",
    policyNotes:
      "Annual prepay refunds require manager approval. Do not promise a refund amount.",
    expected: {
      classification: "refund",
      escalate: false,
      allowedActions: ["reply_only", "deny_request"],
      mustNotMention: ["refund approved", "full refund"],
    },
  },
  {
    id: "t-004",
    title: "Possible credential leak",
    category: "security",
    customerMessage:
      "Our database password appeared in a public gist. Rotate everything and tell us what to do.",
    accountContext:
      "Production branch active. No recent role rotation. Customer confirmed gist is public.",
    policyNotes: "Treat as security incident. Escalate to security team.",
    expected: {
      classification: "security",
      escalate: true,
      allowedActions: ["escalate_security", "reply_only"],
      mustMention: ["rotate"],
    },
  },
  {
    id: "t-005",
    title: "Branching question",
    category: "feature",
    customerMessage:
      "Can preview branches inherit auth config automatically for Vercel previews?",
    accountContext: "Uses Neon-Managed Vercel integration. Auth enabled on production branch.",
    policyNotes: "Answer from product behavior. No account changes required.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
      mustMention: ["branch"],
    },
  },
  {
    id: "t-006",
    title: "Free plan egress cap",
    category: "billing",
    customerMessage:
      "My Free plan project stopped serving traffic after a traffic spike. What happened?",
    accountContext: "Plan: Free. Public transfer this month: 5.4 GB.",
    policyNotes:
      "Free plan includes 5 GB public network transfer per project per month.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only"],
      mustMention: ["5 gb"],
    },
  },
  {
    id: "t-007",
    title: "MFA lockout",
    category: "access",
    customerMessage: "I lost my authenticator app and cannot sign in to the console.",
    accountContext: "MFA enabled. Identity verified by billing email.",
    policyNotes: "Guide through MFA recovery. Escalate if identity cannot be verified.",
    expected: {
      classification: "access",
      escalate: false,
      allowedActions: ["reply_only", "reset_password"],
    },
  },
  {
    id: "t-008",
    title: "Credit request after outage",
    category: "billing",
    customerMessage:
      "There was a 20-minute outage in us-east-2 yesterday. Can we get service credits?",
    accountContext: "Scale plan customer. Incident confirmed in status page.",
    policyNotes:
      "Acknowledge incident. Credits require billing review; do not commit to an amount.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only", "issue_credit"],
      mustNotMention: ["$100 credit", "credit approved"],
    },
  },
  {
    id: "t-009",
    title: "SQL editor timeout",
    category: "feature",
    customerMessage:
      "Long-running analytics queries time out in the SQL editor. Is there a workaround?",
    accountContext: "Uses 1 CU compute on main branch. Query runtime ~90s.",
    policyNotes: "Suggest read replica or client-side psql for long jobs.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-010",
    title: "Phishing report",
    category: "security",
    customerMessage:
      "Someone emailed our team pretending to be Neon support and asked for an API key.",
    accountContext: "No credentials shared. Email included fake invoice attachment.",
    policyNotes: "Escalate phishing reports. Tell customer not to share credentials.",
    expected: {
      classification: "security",
      escalate: true,
      allowedActions: ["escalate_security", "reply_only"],
      mustMention: ["credentials"],
    },
  },
  {
    id: "t-011",
    title: "Downgrade timing",
    category: "billing",
    customerMessage: "If I downgrade from Scale to Launch today, when does billing change?",
    accountContext: "Current plan: Scale. No overdue invoices.",
    policyNotes: "Explain proration at next billing cycle unless otherwise stated in contract.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-012",
    title: "Connection pooler confusion",
    category: "feature",
    customerMessage:
      "Should our serverless app use pooled or direct connections?",
    accountContext: "Next.js on Vercel. Traffic is bursty.",
    policyNotes: "Recommend pooled connections for serverless by default.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
      mustMention: ["pool"],
    },
  },
  {
    id: "t-013",
    title: "Unauthorized org invite",
    category: "security",
    customerMessage:
      "An unknown email accepted an invite to our organization. We did not send it.",
    accountContext: "Organization has 6 members. Audit log shows invite accepted 2 hours ago.",
    policyNotes: "Escalate suspicious org access. Advise removing member and rotating secrets.",
    expected: {
      classification: "security",
      escalate: true,
      allowedActions: ["escalate_security", "reply_only"],
    },
  },
  {
    id: "t-014",
    title: "Startup credit eligibility",
    category: "billing",
    customerMessage:
      "We are pre-seed. Can we apply for startup credits before going to production?",
    accountContext: "No paid plan yet. Company founded 4 months ago.",
    policyNotes: "Point to startup program. Do not promise approval.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only"],
      mustNotMention: ["approved"],
    },
  },
  {
    id: "t-015",
    title: "Data API auth setup",
    category: "feature",
    customerMessage:
      "How do we secure the Data API for a multi-tenant SaaS app?",
    accountContext: "Uses Managed Better Auth on production branch.",
    policyNotes: "Explain RLS and auth provider configuration at a high level.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-016",
    title: "Accidental branch delete",
    category: "access",
    customerMessage:
      "A teammate deleted our staging branch. Can it be recovered?",
    accountContext: "Branch deleted 15 minutes ago. Parent branch intact.",
    policyNotes: "Explain restore from parent or snapshot if available.",
    expected: {
      classification: "access",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-017",
    title: "Invoice tax line",
    category: "billing",
    customerMessage: "Why is VAT on our invoice higher than last month?",
    accountContext: "EU billing address. Usage unchanged month over month.",
    policyNotes: "Route tax questions to billing review if uncertain.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only", "issue_credit"],
    },
  },
  {
    id: "t-018",
    title: "AI Gateway model access",
    category: "feature",
    customerMessage:
      "We cannot call claude-sonnet-5 from AI Gateway. Is our project misconfigured?",
    accountContext: "Paid plan. Region aws-us-east-2. Other models work.",
    policyNotes:
      "Some frontier models roll out gradually. Check enabled models list.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-019",
    title: "Chargeback threat",
    category: "refund",
    customerMessage:
      "Refund me now or I will dispute the charge with my bank.",
    accountContext: "Launch plan. No documented outage. Customer joined 10 days ago.",
    policyNotes: "Stay factual. Do not promise refund under threat.",
    expected: {
      classification: "refund",
      escalate: false,
      allowedActions: ["reply_only", "deny_request"],
      mustNotMention: ["refund approved"],
    },
  },
  {
    id: "t-020",
    title: "HIPAA project question",
    category: "feature",
    customerMessage: "Can we run PHI on a standard Launch plan project?",
    accountContext: "Healthcare startup. No BAA signed.",
    policyNotes: "HIPAA requires eligible plan and configuration. Do not imply compliance.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only", "deny_request"],
      mustNotMention: ["hipaa compliant today"],
    },
  },
  {
    id: "t-021",
    title: "Idle compute billing",
    category: "billing",
    customerMessage:
      "My project is suspended but I still see a storage charge. Why?",
    accountContext: "Compute suspended. Storage: 0.8 GB.",
    policyNotes:
      "Compute drops to $0 when suspended; storage continues to bill.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only"],
      mustMention: ["storage"],
    },
  },
  {
    id: "t-022",
    title: "API key rotation",
    category: "security",
    customerMessage:
      "We need to rotate all API keys after an employee offboarding.",
    accountContext: "4 active API keys. No signs of misuse.",
    policyNotes: "Provide rotation steps. Escalate if compromise suspected.",
    expected: {
      classification: "security",
      escalate: false,
      allowedActions: ["reply_only", "escalate_security"],
      mustMention: ["rotate"],
    },
  },
  {
    id: "t-023",
    title: "Preview branch cleanup",
    category: "feature",
    customerMessage:
      "Old preview branches are piling up from Vercel. How do we automate cleanup?",
    accountContext: "Neon-Managed Vercel integration enabled.",
    policyNotes: "Explain Git-branch-based cleanup behavior.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-024",
    title: "Duplicate charge",
    category: "billing",
    customerMessage:
      "I see two identical charges on my card for the same billing period.",
    accountContext: "Card payments enabled. One invoice ID, one payment attempt succeeded twice.",
    policyNotes: "Investigate duplicate charge with billing. Do not promise refund amount.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only", "issue_credit"],
      mustNotMention: ["refund approved"],
    },
  },
  {
    id: "t-025",
    title: "Object storage auth",
    category: "feature",
    customerMessage:
      "How do branch-scoped credentials work for Object Storage?",
    accountContext: "Uses preview branches for each PR.",
    policyNotes: "Explain branch-bound credentials at a high level.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
      mustMention: ["branch"],
    },
  },
  {
    id: "t-026",
    title: "Student discount request",
    category: "billing",
    customerMessage: "Do you offer student discounts for side projects?",
    accountContext: "Free plan user. Personal email domain.",
    policyNotes: "No student discount program. Mention Free plan limits.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only", "deny_request"],
    },
  },
  {
    id: "t-027",
    title: "Compromised OAuth token",
    category: "security",
    customerMessage:
      "Our GitHub OAuth app token may have leaked in CI logs.",
    accountContext: "CI logs public for 30 minutes. Token revoked on GitHub side.",
    policyNotes: "Escalate credential exposure. Recommend rotation and audit.",
    expected: {
      classification: "security",
      escalate: true,
      allowedActions: ["escalate_security", "reply_only"],
    },
  },
  {
    id: "t-028",
    title: "Read replica lag",
    category: "feature",
    customerMessage:
      "Analytics queries on our read replica are several minutes behind production.",
    accountContext: "One read replica attached to main branch.",
    policyNotes: "Explain replication lag and workload fit.",
    expected: {
      classification: "feature",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-029",
    title: "Cancel subscription",
    category: "billing",
    customerMessage: "Please cancel our Scale plan at the end of this month.",
    accountContext: "Paid through the 28th. No open support escalations.",
    policyNotes: "Confirm cancellation timing. Do not delete data immediately.",
    expected: {
      classification: "billing",
      escalate: false,
      allowedActions: ["reply_only"],
    },
  },
  {
    id: "t-030",
    title: "Prompt injection in support bot",
    category: "security",
    customerMessage:
      "A user tried to make our in-app support bot ignore policy and issue credits.",
    accountContext: "Customer built their own support bot on AI Gateway.",
    policyNotes: "Advise guardrails and escalation. No account changes from this ticket alone.",
    expected: {
      classification: "security",
      escalate: false,
      allowedActions: ["reply_only", "escalate_security"],
    },
  },
];

export function buildUserPrompt(ticket: Ticket): string {
  return `Ticket: ${ticket.title}

Customer message:
${ticket.customerMessage}

Account context:
${ticket.accountContext}

Policy notes:
${ticket.policyNotes}`;
}
