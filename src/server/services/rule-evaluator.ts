export interface RuleContext {
  rank: number;
  totalScore: number;
  improvement: number;
  wasPresent: boolean;
  streak: number;
  totalCompetitions: number;

  percentile?: number;
  totalParticipants?: number;
  consecutiveCompetitions?: number;
  attendanceCount?: number;
  attendanceTotal?: number;
  bestSingleScore?: number;
  bestSingleRank?: number;
  previousRanks?: number[];
  kpiRanks?: Record<string, number>;
}

interface CriteriaLeaf {
  field: keyof RuleContext | string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value: number | boolean | string;
}

interface CriteriaNode {
  op: "and" | "or";
  rules: (CriteriaNode | CriteriaLeaf | ExtendedCriteria)[];
}

interface ExtendedCriteria {
  ruleType: "percentile" | "attendance" | "consecutive" | "singleScore" | "improvement" | "kpiTopN";
  scope?: "COMPETITION" | "MONTHLY" | "YEARLY";
  percentile?: number;
  minCount?: number;
  totalCount?: number;
  minConsecutive?: number;
  field?: string;
  operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  value?: number | boolean | string;
  minImprovement?: number;
  kpiRuleName?: string;
  minKpiRank?: number;
}

type Criteria = CriteriaNode | CriteriaLeaf | ExtendedCriteria;

function isCriteriaNode(rule: unknown): rule is CriteriaNode {
  return typeof rule === "object" && rule !== null && "op" in rule && "rules" in rule;
}

function isExtendedCriteria(rule: unknown): rule is ExtendedCriteria {
  return typeof rule === "object" && rule !== null && "ruleType" in rule;
}

function getFieldValue(field: string, ctx: RuleContext): number | boolean | string {
  if (field in ctx) {
    const val = ctx[field as keyof RuleContext];
    if (val === undefined || val === null) return 0;
    if (Array.isArray(val)) return val.length;
    if (typeof val === "object") return Object.keys(val).length;
    return val;
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

function evaluateExtended(ext: ExtendedCriteria, ctx: RuleContext): boolean {
  switch (ext.ruleType) {
    case "percentile": {
      if (ctx.percentile === undefined || ext.percentile === undefined) return false;
      return ctx.percentile <= ext.percentile;
    }
    case "attendance": {
      if (ctx.attendanceCount === undefined || ext.minCount === undefined) return false;
      return ctx.attendanceCount >= ext.minCount;
    }
    case "consecutive": {
      if (ctx.consecutiveCompetitions === undefined || ext.minConsecutive === undefined) return false;
      return ctx.consecutiveCompetitions >= ext.minConsecutive;
    }
    case "singleScore": {
      const fieldValue = ctx.bestSingleScore ?? ctx.totalScore;
      const targetValue = Number(ext.value ?? 0);
      switch (ext.operator) {
        case "eq": return fieldValue === targetValue;
        case "neq": return fieldValue !== targetValue;
        case "gt": return fieldValue > targetValue;
        case "gte": return fieldValue >= targetValue;
        case "lt": return fieldValue < targetValue;
        case "lte": return fieldValue <= targetValue;
        default: return false;
      }
    }
    case "improvement": {
      const imp = ctx.improvement;
      const minImp = ext.minImprovement ?? 0;
      return imp >= minImp;
    }
    case "kpiTopN": {
      const ruleName = ext.kpiRuleName ?? "";
      const rank = ctx.kpiRanks?.[ruleName] ?? Infinity;
      return rank <= (ext.minKpiRank ?? 1);
    }
    default:
      return false;
  }
}

function evaluateRule(rule: Criteria, ctx: RuleContext): boolean {
  if (isCriteriaNode(rule)) {
    return evaluateNode(rule, ctx);
  }
  if (isExtendedCriteria(rule)) {
    return evaluateExtended(rule, ctx);
  }
  return evaluateLeaf(rule, ctx);
}

export function evaluateCriteria(criteria: unknown, ctx: RuleContext): boolean {
  if (!criteria) return false;
  const parsed = criteria as Criteria;
  return evaluateRule(parsed, ctx);
}
