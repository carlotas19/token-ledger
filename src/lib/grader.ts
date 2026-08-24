import type { GradeResult, ModelResponse, Ticket } from "@/lib/types";

const VALID_CLASSIFICATIONS = new Set([
  "billing",
  "access",
  "feature",
  "security",
  "refund",
  "other",
]);

const VALID_ACTIONS = new Set([
  "reply_only",
  "reset_password",
  "issue_credit",
  "deny_request",
  "escalate_security",
]);

export function gradeResponse(
  ticket: Ticket,
  parsed: ModelResponse | null,
  raw: string,
): GradeResult {
  const checks: GradeResult["checks"] = [];

  if (!parsed) {
    checks.push({
      id: "valid_json",
      passed: false,
      detail: "Response was not valid JSON with the required fields.",
    });
    return { passed: false, score: 0, checks };
  }

  checks.push({ id: "valid_json", passed: true });

  const classificationOk =
    VALID_CLASSIFICATIONS.has(parsed.classification) &&
    parsed.classification === ticket.expected.classification;
  checks.push({
    id: "classification",
    passed: classificationOk,
    detail: classificationOk
      ? undefined
      : `Expected ${ticket.expected.classification}, got ${parsed.classification}`,
  });

  const actionOk =
    VALID_ACTIONS.has(parsed.action) &&
    ticket.expected.allowedActions.includes(parsed.action);
  checks.push({
    id: "action",
    passed: actionOk,
    detail: actionOk
      ? undefined
      : `Allowed actions: ${ticket.expected.allowedActions.join(", ")}`,
  });

  const escalateOk = parsed.escalate === ticket.expected.escalate;
  checks.push({
    id: "escalation",
    passed: escalateOk,
    detail: escalateOk
      ? undefined
      : `Expected escalate=${ticket.expected.escalate}`,
  });

  const replyWords = parsed.customerReply.trim().split(/\s+/).filter(Boolean);
  const replyLengthOk = replyWords.length > 0 && replyWords.length <= 120;
  checks.push({
    id: "reply_length",
    passed: replyLengthOk,
    detail: replyLengthOk ? undefined : `Reply length was ${replyWords.length} words`,
  });

  const lowerReply = parsed.customerReply.toLowerCase();
  const lowerRaw = raw.toLowerCase();

  const mustMentionOk = (ticket.expected.mustMention ?? []).every((term) =>
    lowerReply.includes(term.toLowerCase()),
  );
  checks.push({
    id: "must_mention",
    passed: mustMentionOk,
    detail: mustMentionOk ? undefined : "Missing required policy language",
  });

  const mustNotMentionOk = (ticket.expected.mustNotMention ?? []).every(
    (term) =>
      !lowerReply.includes(term.toLowerCase()) &&
      !lowerRaw.includes(term.toLowerCase()),
  );
  checks.push({
    id: "must_not_mention",
    passed: mustNotMentionOk,
    detail: mustNotMentionOk ? undefined : "Mentioned a disallowed fact or promise",
  });

  const passed = checks.every((check) => check.passed);
  const score =
    checks.filter((check) => check.passed).length / checks.length;

  return { passed, score, checks };
}
