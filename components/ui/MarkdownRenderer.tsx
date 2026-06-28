"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{
      fontSize: "20px",
      fontWeight: 800,
      color: "#1E293B",
      marginTop: "28px",
      marginBottom: "12px",
      paddingBottom: "8px",
      borderBottom: "2px solid #E2E8F0",
      lineHeight: 1.3,
    }}>
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2 style={{
      fontSize: "17px",
      fontWeight: 700,
      color: "#1E293B",
      marginTop: "24px",
      marginBottom: "10px",
      paddingLeft: "10px",
      borderLeft: "3px solid #6366F1",
      lineHeight: 1.4,
    }}>
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 style={{
      fontSize: "15px",
      fontWeight: 600,
      color: "#334155",
      marginTop: "16px",
      marginBottom: "6px",
      lineHeight: 1.4,
    }}>
      {children}
    </h3>
  ),

  p: ({ children }) => (
    <p style={{
      fontSize: "14px",
      color: "#475569",
      lineHeight: 1.75,
      marginBottom: "10px",
    }}>
      {children}
    </p>
  ),

  strong: ({ children }) => (
    <strong style={{ fontWeight: 600, color: "#1E293B" }}>{children}</strong>
  ),

  em: ({ children }) => (
    <em style={{ color: "#64748B" }}>{children}</em>
  ),

  ul: ({ children }) => (
    <ul style={{
      paddingLeft: "20px",
      marginBottom: "10px",
      listStyleType: "disc",
    }}>
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol style={{
      paddingLeft: "20px",
      marginBottom: "10px",
      listStyleType: "decimal",
    }}>
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li style={{
      fontSize: "14px",
      color: "#475569",
      lineHeight: 1.7,
      marginBottom: "4px",
    }}>
      {children}
    </li>
  ),

  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: "3px solid #CBD5E1",
      paddingLeft: "14px",
      margin: "12px 0",
      color: "#64748B",
      fontStyle: "italic",
    }}>
      {children}
    </blockquote>
  ),

  hr: () => (
    <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "20px 0" }} />
  ),

  code: ({ children }) => (
    <code style={{
      background: "#F1F5F9",
      borderRadius: "4px",
      padding: "2px 6px",
      fontSize: "13px",
      color: "#475569",
      fontFamily: "monospace",
    }}>
      {children}
    </code>
  ),
};

// Bold standalone subheadings that the AI writes as plain "Word:" lines.
// Matches a line that is ONLY a short phrase ending in colon — no text after.
// E.g. "Контакт:" → "**Контакт:**", leaving "Клиент сказал: что-то" untouched.
function boldSubheadings(text: string): string {
  return text.replace(
    /^([А-ЯЁA-Z][а-яёА-ЯЁA-Za-z\s\-/]{0,60}):[ \t]*$/gm,
    "**$1:**",
  );
}

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={className} style={{ minWidth: 0 }}>
      <ReactMarkdown components={components}>
        {boldSubheadings(content)}
      </ReactMarkdown>
    </div>
  );
}
