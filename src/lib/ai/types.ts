export interface AiLeadAnalysis {
  digital_weaknesses: string[];
  business_opportunities: string[];
  digital_maturity_assessment: string;
  missing_conversion_channels: string[];
}

export interface AiLeadResult {
  summary: string;
  analysis: AiLeadAnalysis;
  premium_tier: "$" | "$$" | "$$$";
}

export interface NicheStats {
  category: string;
  total: number;
  no_website: number;
  poor_website: number;
  avg_score: number;
}

export interface AiNiche {
  category: string;
  rank: number;
  opportunity_level: "high" | "medium" | "low";
  explanation: string;
}

export interface AiNichesResult {
  niches: AiNiche[];
  analyzed_at: string;
}
