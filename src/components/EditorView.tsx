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
    
    // Helper to escape regex special characters
    const escapeRegex = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Sort errors by text length descending to avoid partial replacement issues
    const sortedErrors = [...errors].sort((a, b) => b.originalText.length - a.originalText.length);

    sortedErrors.forEach(err => {
      const isSelected = err.id === selectedErrorId;
      // Highlighting logic: Red text with underline for all, prominent for selected
      const highlightClass = isSelected 
        ? "bg-red-600 text-white px-1 rounded shadow-[0_0_15px_rgba(220,38,38,0.5)] ring-4 ring-red-200 scale-102 inline-block transition-all duration-300 font-bold z-10 relative mx-0.5" 
        : "bg-red-600/10 border-b-2 border-red-500/50 cursor-pointer hover:bg-red-600/20 transition-all text-red-900 font-medium decoration-wavy";
      
      const anchorId = `error-${err.id}`;
      const originalText = err.originalText;
      
      // Basic check if already highlighted
      if (highlightedContent.includes(`data-error-id="${err.id}"`)) return;

      // Handle common HTML entities that mammoth/browser might introduce
      const escapedOriginalText = originalText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const replacement = `<span id="${anchorId}" class="${highlightClass}" data-error-id="${err.id}" title="${err.message.replace(/"/g, '&quot;')}">${originalText}</span>`;
      
      // Try exact match in the HTML first
      if (highlightedContent.includes(originalText)) {
        // Use regex for global replacement to handle all occurrences if they aren't part of a tag
        // We use a simple strategy: only replace if it's not inside a tag
        const regex = new RegExp(escapeRegex(originalText), 'g');
        highlightedContent = highlightedContent.replace(regex, (match, offset) => {
           // Basic check: is this inside a tag?
           const before = highlightedContent.substring(0, offset);
           const openTags = before.split('<').length - 1;
           const closeTags = before.split('>').length - 1;
           if (openTags > closeTags) return match; // Inside a tag
           return replacement;
        });
      } else if (highlightedContent.includes(escapedOriginalText)) {
        const regex = new RegExp(escapeRegex(escapedOriginalText), 'g');
        highlightedContent = highlightedContent.replace(regex, (match, offset) => {
           const before = highlightedContent.substring(0, offset);
           const openTags = before.split('<').length - 1;
           const closeTags = before.split('>').length - 1;
           if (openTags > closeTags) return match;
           return `<span id="${anchorId}" class="${highlightClass}" data-error-id="${err.id}" title="${err.message.replace(/"/g, '&quot;')}">${match}</span>`;
        });
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
      className="word-document-viewer"
    >
      <div 
        ref={containerRef}
        className="max-w-none"
        style={{
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '14pt',
          color: '#000'
        }}
      />
    </div>
  );
}
