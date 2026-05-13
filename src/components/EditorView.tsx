import { useEffect, useRef } from 'react';
import { ProofreadingError } from '../types';

interface EditorViewProps {
  content: string;
  errors: ProofreadingError[];
  selectedErrorId: string | null;
}

export default function EditorView({ content, errors, selectedErrorId }: EditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    let highlightedContent = content;
    
    // Sort errors by text length descending to avoid partial replacement issues
    const sortedErrors = [...errors].sort((a, b) => b.originalText.length - a.originalText.length);

    sortedErrors.forEach(err => {
      const isSelected = err.id === selectedErrorId;
      // Highlighting logic: Red text with underline for all, prominent for selected
      const highlightClass = isSelected 
        ? "bg-red-600 text-white px-1 rounded shadow-[0_0_15px_rgba(220,38,38,0.5)] ring-4 ring-red-200 scale-110 inline-block transition-all duration-300 font-bold z-10 relative" 
        : "bg-red-600/20 border-b-2 border-red-600 cursor-pointer hover:bg-red-600/40 transition-all text-red-800 font-medium";
      
      const anchorId = `error-${err.id}`;
      // Basic text replacement - inserting a span with specific ID and class
      // Note: This matches exact text. If word formatting splits text, this might miss.
      const replacement = `<span id="${anchorId}" class="${highlightClass}" data-error-id="${err.id}" title="${err.message}">${err.originalText}</span>`;
      
      // Only replace if not already wrapped (basic check)
      if (!highlightedContent.includes(`data-error-id="${err.id}"`)) {
        // Try exact match first
        if (highlightedContent.includes(err.originalText)) {
          highlightedContent = highlightedContent.split(err.originalText).join(replacement);
        } else {
          // Try trimmed match just in case
          const trimmed = err.originalText.trim();
          if (trimmed && highlightedContent.includes(trimmed)) {
            const trimmedReplacement = `<span id="${anchorId}" class="${highlightClass}" data-error-id="${err.id}" title="${err.message}">${trimmed}</span>`;
            highlightedContent = highlightedContent.split(trimmed).join(trimmedReplacement);
          }
        }
      }
    });

    containerRef.current.innerHTML = highlightedContent;
  }, [content, errors, selectedErrorId]);

  useEffect(() => {
    if (selectedErrorId) {
      const element = document.getElementById(`error-${selectedErrorId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedErrorId]);

  return (
    <div 
      className="bg-white mx-auto shadow-2xl min-h-full p-[2cm] overflow-x-auto word-document-container"
      style={{ 
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box'
      }}
    >
      <div 
        ref={containerRef}
        className="prose prose-slate max-w-none prose-p:my-0"
        style={{
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '14pt',
          lineHeight: '1.5',
          color: '#000'
        }}
      />
    </div>
  );
}
