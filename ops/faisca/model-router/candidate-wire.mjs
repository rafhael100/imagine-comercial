import {
  isTrustedCandidateOnlyEgress
} from './contract.mjs';
import { validateCandidateOnlyDecision } from './decision-bridge.mjs';

export const CANDIDATE_WIRE_REQUEST_SCHEMA = 'faisca.candidate-only-wire.request.v1';
export const MAX_CANDIDATE_WIRE_BYTES = 1024;
export const MAX_CANDIDATE_DECISION_BYTES = 256;

/**
 * R49: canonical transport bytes for a possible FUTURE, separately approved
 * out-of-process selector. Raw R09 requests CANNOT be passed to this function.
 *
 * This module does NOT implement fetch, sockets, HTTP clients, telemetry,
 * credentials, budgets or an external provider. A wire contract is not
 * permission to transmit data to an outside system.
 */
export function serializeCandidateOnlyWireRequest(egress) {
  if (!isTrustedCandidateOnlyEgress(egress)) return null;
  const wire = Object.freeze({
    schema: CANDIDATE_WIRE_REQUEST_SCHEMA,
    task: egress.task,
    locale: egress.locale,
    catalogVersion: egress.catalogVersion,
    rankedAnswerIds: Object.freeze([...egress.rankedAnswerIds]),
    allowedClarificationIds: Object.freeze([...egress.allowedClarificationIds]),
    maxSelectedIds: egress.limits.maxSelectedIds,
    maxOutputChars: egress.limits.maxOutputChars
  });
  const body = JSON.stringify(wire);
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes < 1 || bytes > MAX_CANDIDATE_WIRE_BYTES) return null;
  return Object.freeze({
    schema: CANDIDATE_WIRE_REQUEST_SCHEMA,
    contentType: 'application/json',
    bytes,
    body
  });
}

/** Reject unconstrained prose/objects/URLs, oversized responses, or fields.
 * Return ONLY the selected closed IDs. The host owns all correlation and
 * editorial answer text outside this wire protocol.
 */
export function parseCandidateOnlyWireDecision(rawText, trustedEgress) {
  if (!isTrustedCandidateOnlyEgress(trustedEgress) ||
      typeof rawText !== 'string' ||
      Buffer.byteLength(rawText, 'utf8') < 2 ||
      Buffer.byteLength(rawText, 'utf8') > MAX_CANDIDATE_DECISION_BYTES) return null;
  let raw;
  try { raw = JSON.parse(rawText); }
  catch { return null; }
  return validateCandidateOnlyDecision(raw, trustedEgress);
}
