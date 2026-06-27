"use client";

/**
 * AnalysisBlockRenderer — renders structured analysis blocks.
 *
 * If blocks are present (Step 2 extraction was done):
 *   - Each block's content is rendered via MarkdownRenderer
 *   - Interpretive blocks with valid evidenceTooltip get a 🔍 icon
 *
 * If blocks are absent (old analysis or extraction not yet done):
 *   - Falls back to MarkdownRenderer(result) — identical to previous behavior
 */

import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { EvidenceTooltip, hasValidEvidenceTooltip } from "./EvidenceTooltip";
import type { AnalysisBlock } from "@/lib/analysisBlocks";

interface Props {
  result: string;
  blocks?: AnalysisBlock[];
  showLupa?: boolean;
}

export function AnalysisBlockRenderer({ result, blocks, showLupa = true }: Props) {
  // No blocks — render exactly as before (backward compat)
  if (!blocks || blocks.length === 0) {
    return <MarkdownRenderer content={result} />;
  }

  return (
    <div>
      {blocks.map((block) => {
        let canShowLupa = false;
        try {
          canShowLupa = showLupa && hasValidEvidenceTooltip(block);
        } catch {
          // Defensive: never crash if block data is malformed
        }

        return (
          <div
            key={block.id}
            style={{ position: "relative", paddingRight: canShowLupa ? 34 : 0 }}
          >
            {canShowLupa && (
              <div
                style={{
                  position: "absolute",
                  top:      4,
                  right:    0,
                  zIndex:   10,
                }}
              >
                <EvidenceTooltip
                  tooltip={block.evidenceTooltip!}
                  confidence={block.confidence}
                  evidenceRefs={block.evidenceRefs}
                />
              </div>
            )}
            <MarkdownRenderer content={block.content} />
          </div>
        );
      })}
    </div>
  );
}
