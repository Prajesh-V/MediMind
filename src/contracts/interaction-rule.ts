export type InteractionSeverity = 'low' | 'moderate' | 'high';
export type RuleStatus = 'draft' | 'submitted' | 'approved' | 'retired';

export interface EvidenceReference {
  source: 'rxnorm' | 'dailymed' | 'openfda' | 'pubchem';
  externalIdentifier?: string;
  sourceUrl: string;
  citationText: string;
  excerptLocator?: string;
}

export interface RuleCandidate {
  ruleKey: string;
  version: number;
  status: RuleStatus;
  medicationSelector: Record<string, unknown>;
  foodComponentSelector: Record<string, unknown>;
  temporalLogic: Record<string, unknown>;
  severity: InteractionSeverity;
  mechanism: string;
  effect: string;
  recommendationTemplate: string;
  evidence: EvidenceReference[];
}

export interface RuleApprovalRecord {
  ruleId: string;
  reviewerUserId: string;
  reviewerCredentialReference: string;
  decision: 'approved' | 'rejected';
  reviewNote: string;
  reviewedAt: string;
}

export interface InteractionAssessment {
  interactionFound: boolean;
  severity: InteractionSeverity | 'none';
  ruleId?: string;
  ruleVersion?: number;
  medicationId: string;
  foodRecordId: string;
  foodComponentId?: string;
  timeDeltaHours?: number;
  mechanism?: string;
  effect?: string;
  recommendation?: string;
  evidence: EvidenceReference[];
  evaluatedAt: string;
  evidenceUnavailable: boolean;
}
