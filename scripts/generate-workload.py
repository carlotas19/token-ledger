#!/usr/bin/env python3
"""Generate the fixed 100-ticket Token Ledger workload."""

import json
from pathlib import Path

SCENARIOS = [
    ("billing", "Unexpected invoice line", "I was charged $42 this month but expected the Launch plan minimum. Can you explain the invoice?", "Plan: Launch. Active projects: 3. Storage: 2.1 GB. Compute usage: 38 CU-hours.", "Explain compute and storage separately. Do not issue credits without billing review.", False, ["reply_only"], ["storage"], ["full refund approved"]),
    ("access", "Password reset loop", "I still get an invalid password error after resetting through email.", "User verified. SSO not enabled. No security holds.", "Offer password reset guidance. Do not escalate unless the reset fails again.", False, ["reset_password", "reply_only"], ["reset"], []),
    ("refund", "Annual prepay refund", "We prepaid annually but are shutting down. Please refund the unused months.", "Annual contract started 45 days ago.", "Annual refunds require manager review. Never promise an amount.", False, ["reply_only", "deny_request"], [], ["refund approved", "full refund"]),
    ("security", "Credential leak", "Our database password appeared in a public gist.", "Production branch active. The gist is confirmed public.", "Treat this as a security incident. Recommend rotation and escalate.", True, ["escalate_security"], ["rotate"], []),
    ("feature", "Preview branch auth", "Can preview branches inherit auth configuration for Vercel previews?", "Neon-managed Vercel integration. Auth enabled on production.", "Explain branch behavior. No account changes.", False, ["reply_only"], ["branch"], []),
    ("billing", "Free plan transfer cap", "My Free plan project stopped serving traffic after a traffic spike.", "Public network transfer this month: 5.4 GB.", "The Free plan includes 5 GB public network transfer per project per month.", False, ["reply_only"], ["5 gb"], []),
    ("access", "MFA lockout", "I lost my authenticator app and cannot sign in.", "MFA enabled. Identity verified by billing email.", "Guide through MFA recovery. Escalate only if identity cannot be verified.", False, ["reply_only"], ["recovery"], []),
    ("billing", "Service credit request", "There was a confirmed 20-minute outage. Can we get service credits?", "Scale plan. Incident confirmed.", "Acknowledge the incident. Credits require billing review.", False, ["reply_only", "issue_credit"], ["review"], ["credit approved", "$100"]),
    ("feature", "SQL editor timeout", "Long analytics queries time out in the SQL editor. What should we do?", "Query runtime is about 90 seconds.", "Suggest a read replica or client-side psql for long jobs.", False, ["reply_only"], [], []),
    ("security", "Phishing report", "Someone pretending to be support asked our team for an API key.", "No credentials were shared.", "Escalate phishing reports. Tell the customer not to share credentials.", True, ["escalate_security"], ["credentials"], []),
    ("billing", "Plan downgrade", "If I downgrade from Scale to Launch today, when does billing change?", "No overdue invoices.", "Explain that timing depends on the billing cycle. Do not invent a date.", False, ["reply_only"], ["billing"], []),
    ("feature", "Connection pooling", "Should our serverless app use pooled or direct connections?", "Next.js on Vercel with bursty traffic.", "Recommend pooled connections by default.", False, ["reply_only"], ["pool"], []),
    ("security", "Unknown organization member", "An unknown email accepted an organization invite we did not send.", "Audit log shows acceptance two hours ago.", "Escalate suspicious access. Recommend removing the member and rotating secrets.", True, ["escalate_security"], ["remove"], []),
    ("billing", "Startup program", "Can our pre-seed company apply for startup credits before production?", "No paid plan. Company founded four months ago.", "Point to the startup program. Do not promise acceptance.", False, ["reply_only"], ["apply"], ["approved", "accepted"]),
    ("feature", "Data API access control", "How should we secure the Data API for a multi-tenant SaaS app?", "Managed Better Auth is enabled.", "Explain row-level security and auth configuration at a high level.", False, ["reply_only"], ["row"], []),
    ("access", "Deleted staging branch", "A teammate deleted our staging branch. Can it be recovered?", "Deleted 15 minutes ago. Parent branch exists.", "Explain recovery from parent or snapshot if available.", False, ["reply_only"], ["snapshot"], []),
    ("billing", "VAT change", "Why is VAT on our invoice higher than last month?", "EU billing address. Usage unchanged.", "Route uncertain tax details to billing review. Do not invent a tax rate.", False, ["reply_only"], ["review"], ["20%"]),
    ("feature", "Gateway model unavailable", "We cannot call a frontier model from AI Gateway, but other models work.", "Paid plan in aws-us-east-2.", "Some frontier models roll out gradually. Suggest checking the enabled model list.", False, ["reply_only"], ["enabled"], []),
    ("refund", "Chargeback threat", "Refund me now or I will dispute the charge with my bank.", "Launch plan. No documented outage.", "Stay factual. Do not promise a refund.", False, ["reply_only", "deny_request"], [], ["refund approved"]),
    ("security", "OAuth token in logs", "Our GitHub OAuth token may have leaked in public CI logs.", "Log was public for 30 minutes. Token has been revoked.", "Treat as credential exposure. Escalate and recommend rotation plus audit.", True, ["escalate_security"], ["rotate"], []),
]

VARIANTS = [
    ("direct", ""),
    ("urgent", " This is blocking our team today."),
    ("frustrated", " We have already spent too much time on this."),
    ("next_steps", " Please give us the next concrete step."),
    ("nontechnical", " Please explain this without assuming deep technical knowledge."),
]


def main() -> None:
    tickets = []
    for scenario_index, scenario in enumerate(SCENARIOS, start=1):
        (
            category,
            title,
            message,
            context,
            policy,
            escalate,
            actions,
            must_mention,
            must_not_mention,
        ) = scenario
        for variant_index, (variant, suffix) in enumerate(VARIANTS, start=1):
            tickets.append(
                {
                    "id": f"t-{scenario_index:02d}-{variant_index}",
                    "scenario": title,
                    "variant": variant,
                    "category": category,
                    "customerMessage": message + suffix,
                    "accountContext": context,
                    "policyNotes": policy,
                    "expected": {
                        "classification": category,
                        "escalate": escalate,
                        "allowedActions": actions,
                        "mustMention": must_mention,
                        "mustNotMention": must_not_mention,
                    },
                }
            )

    root = Path(__file__).resolve().parents[1]
    outputs = [root / "benchmark" / "workload.json", root / "public" / "workload.json"]
    for output in outputs:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(tickets, indent=2) + "\n")
    print(f"Wrote {len(tickets)} tickets to {outputs[0]} and {outputs[1]}")


if __name__ == "__main__":
    main()
