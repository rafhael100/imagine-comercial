import test from "node:test";
import assert from "node:assert/strict";
import { evaluateReleaseEvidence, REQUIRED_GATES } from "../ops/review/purchase/check-release-evidence.mjs";

const sha = "a".repeat(40);
const url = "https://github.com/rafhael100/imagine-comercial/actions/runs/12345";
const fixture = () => ({
  environment: "production",
  releaseApproval: "approved-by-operator",
  comercialCommit: sha, portalCommit: sha,
  gates: REQUIRED_GATES.map(id => ({id, status:"pass", evidence:[url], verifiedCommit:sha}))
});
test("missing evidence fails closed", () => {
  assert.equal(evaluateReleaseEvidence({}).ready, false);
  assert.equal(evaluateReleaseEvidence(null).ready, false);
});
test("syntactically complete inventory still requires manual review", () => {
  assert.equal(evaluateReleaseEvidence(fixture()).ready, true);
});
test("missing, duplicate, invalid evidence and pending approvals fail", () => {
  const cases = [
    doc => {doc.gates.pop();},
    doc => {doc.gates[0] = doc.gates[1];},
    doc => {doc.gates[0].evidence = ["https://evil.example/123"];},
    doc => {doc.gates[0].status = "pending";},
    doc => {doc.gates[0].verifiedCommit = "main";},
    doc => {doc.releaseApproval = "pending";},
    doc => {doc.portalCommit = "dev";},
    doc => {doc.gates[0].evidence = ["https://github.com/rafhael100/imagine-comercial/pull/1?token=abc"];}
  ];
  for (const mutation of cases) {
    const doc=fixture(); mutation(doc);
    assert.equal(evaluateReleaseEvidence(doc).ready, false);
  }
});
