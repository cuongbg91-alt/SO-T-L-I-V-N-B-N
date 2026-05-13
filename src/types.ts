
export type RuleConfig = 'nd30-baocao' | 'nd30-quyetdinh' | 'hd36-dang';

export interface ProofreadingError {
  id: string;
  type: 'format' | 'spelling' | 'grammar' | 'logic';
  message: string;
  suggestion: string;
  originalText: string;
  page?: number;
  line?: number;
  severity: 'low' | 'medium' | 'high';
}

export interface DocumentState {
  rawText: string;
  htmlContent: string;
  fileName: string;
}
