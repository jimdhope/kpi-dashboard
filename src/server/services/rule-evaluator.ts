export interface RuleContext {
  rank: number;
  totalScore: number;
  improvement: number;
  wasPresent: boolean;
  streak: number;
  totalCompetitions: number;
}

interface CriteriaLeaf {
  field: keyof RuleContext | string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value: number | boolean | string;
}

interface CriteriaNode {
  op: "and" | "or";
  rules: (CriteriaNode | CriteriaLeaf)[];
}

type Criteria = CriteriaNode | CriteriaLeaf;

function isCriteriaNode(rule: unknown): rule is CriteriaNode {
  return typeof rule === "object" && rule !== null && "op" in rule && "rules" in rule;
}

function getFieldValue(field: string, ctx: RuleContext): number | boolean | string {
  if (field in ctx) {
    return ctx[field as keyof RuleContext];
  }
  return 0;
}

function evaluateLeaf(leaf: CriteriaLeaf, ctx: RuleContext): boolean {
  const fieldValue = getFieldValue(leaf.field, ctx);
  const targetValue = leaf.value;

  switch (leaf.operator) {
    case "eq": return fieldValue === targetValue;
    case "neq": return fieldValue !== targetValue;
    case "gt": return Number(fieldValue) > Number(targetValue);
    case "gte": return Number(fieldValue) >= Number(targetValue);
    case "lt": return Number(fieldValue) < Number(targetValue);
    case "lte": return Number(fieldValue) <= Number(targetValue);
    default: return false;
  }
}

function evaluateNode(node: CriteriaNode, ctx: RuleContext): boolean {
  if (node.op === "and") {
    return node.rules.every((rule) => evaluateRule(rule, ctx));
  } else {
    return node.rules.some((rule) => evaluateRule(rule, ctx));
  }
}

function evaluateRule(rule: Criteria, ctx: RuleContext): boolean {
  if (isCriteriaNode(rule)) {
    return evaluateNode(rule, ctx);
  }
  return evaluateLeaf(rule, ctx);
}

export function evaluateCriteria(criteria: unknown, ctx: RuleContext): boolean {
  if (!criteria) return false;
  const parsed = criteria as Criteria;
  return evaluateRule(parsed, ctx);
}
