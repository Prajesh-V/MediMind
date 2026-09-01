/**
 * Server-side contract for source adapters. No adapter implementation or network
 * call exists in M0.
 */
export type MedicalSourceName = 'rxnorm' | 'dailymed' | 'openfda' | 'pubchem';

export interface SourceProvenance {
  source: MedicalSourceName;
  externalIdentifier: string;
  sourceUrl: string;
  retrievedAt: string;
  sourceVersion?: string;
}

export interface DrugNormalizationCandidate {
  normalizedName: string;
  rxcui?: string;
  brandNames: string[];
  genericNames: string[];
  strength?: string;
  dosageForm?: string;
  provenance: SourceProvenance;
}

export interface MedicationLabelRecord {
  normalizedMedicationId: string;
  administrationGuidance: string[];
  warnings: string[];
  precautions: string[];
  foodRelatedInformation: string[];
  provenance: SourceProvenance;
}

export interface MedicalSourceAdapter {
  readonly source: MedicalSourceName;
  normalizeDrug(query: string): Promise<DrugNormalizationCandidate[]>;
  getMedicationLabel(normalizedMedicationId: string): Promise<MedicationLabelRecord | null>;
}
