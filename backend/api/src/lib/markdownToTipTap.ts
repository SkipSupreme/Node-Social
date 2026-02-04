/**
 * Converts markdown text to TipTap/ProseMirror JSON format.
 *
 * This is a simplified converter that handles the common markdown patterns
 * used in the existing posts. For full markdown support, consider using
 * a library like 'marked' or 'remark' with custom transforms.
 */

interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

/**
 * Parse inline formatting (bold, italic, code, links) from text
 */
function parseInlineFormatting(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];

  // Combined regex for all inline formats
  // Order matters: links first, then bold (must come before italic to handle ** vs *)
  const patterns = [
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },           // [text](url)
    { regex: /\*\*([^*]+)\*\*/g, type: 'bold' },                   // **bold**
    { regex: /\*([^*]+)\*/g, type: 'italic' },                     // *italic*
    { regex: /`([^`]+)`/g, type: 'code' },                         // `code`
  ];

  let lastIndex = 0;
  const matches: Array<{
    index: number;
    length: number;
    text: string;
    marks: TipTapMark[];
  }> = [];

  // Find all matches
  for (const { regex, type } of patterns) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const marks: TipTapMark[] = [];
      let matchedText = match[1];

      if (type === 'link') {
        marks.push({ type: 'link', attrs: { href: match[2] } });
      } else if (type === 'bold') {
        marks.push({ type: 'bold' });
      } else if (type === 'italic') {
        marks.push({ type: 'italic' });
      } else if (type === 'code') {
        marks.push({ type: 'code' });
      }

      matches.push({
        index: match.index,
        length: match[0].length,
        text: matchedText,
        marks,
      });
    }
  }

  // Sort matches by position and filter overlapping
  matches.sort((a, b) => a.index - b.index);
  const filteredMatches: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.index >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.index + m.length;
    }
  }

  // Build nodes from matches
  for (const m of filteredMatches) {
    // Add plain text before this match
    if (m.index > lastIndex) {
      const plainText = text.substring(lastIndex, m.index);
      if (plainText) {
        nodes.push({ type: 'text', text: plainText });
      }
    }

    // Add formatted text
    nodes.push({
      type: 'text',
      text: m.text,
      marks: m.marks,
    });

    lastIndex = m.index + m.length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      nodes.push({ type: 'text', text: remainingText });
    }
  }

  // If no formatting found, return single text node
  if (nodes.length === 0 && text) {
    nodes.push({ type: 'text', text });
  }

  return nodes;
}

/**
 * Parse a single line into a TipTap node
 */
function parseLine(line: string): TipTapNode | null {
  // Headers
  const h1Match = line.match(/^# (.+)$/);
  if (h1Match) {
    return {
      type: 'heading',
      attrs: { level: 1 },
      content: parseInlineFormatting(h1Match[1]),
    };
  }

  const h2Match = line.match(/^## (.+)$/);
  if (h2Match) {
    return {
      type: 'heading',
      attrs: { level: 2 },
      content: parseInlineFormatting(h2Match[1]),
    };
  }

  const h3Match = line.match(/^### (.+)$/);
  if (h3Match) {
    return {
      type: 'heading',
      attrs: { level: 3 },
      content: parseInlineFormatting(h3Match[1]),
    };
  }

  // Blockquote
  const quoteMatch = line.match(/^>\s*(.*)$/);
  if (quoteMatch) {
    return {
      type: 'blockquote',
      content: [{
        type: 'paragraph',
        content: parseInlineFormatting(quoteMatch[1]),
      }],
    };
  }

  // Horizontal rule
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
    return { type: 'horizontalRule' };
  }

  // Empty line (paragraph break)
  if (!line.trim()) {
    return null;
  }

  // Regular paragraph
  return {
    type: 'paragraph',
    content: parseInlineFormatting(line),
  };
}

/**
 * Parse bullet list items
 */
function parseBulletList(lines: string[]): { node: TipTapNode; consumed: number } {
  const items: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(/^[-*•]\s+(.*)$/);
    if (!match) break;

    items.push({
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: parseInlineFormatting(match[1]),
      }],
    });
    i++;
  }

  return {
    node: { type: 'bulletList', content: items },
    consumed: i,
  };
}

/**
 * Parse ordered list items
 */
function parseOrderedList(lines: string[]): { node: TipTapNode; consumed: number } {
  const items: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i].match(/^\d+\.\s+(.*)$/);
    if (!match) break;

    items.push({
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: parseInlineFormatting(match[1]),
      }],
    });
    i++;
  }

  return {
    node: { type: 'orderedList', content: items },
    consumed: i,
  };
}

/**
 * Parse code block
 */
function parseCodeBlock(lines: string[]): { node: TipTapNode; consumed: number } | null {
  if (!lines[0].startsWith('```')) return null;

  const codeLines: string[] = [];
  let i = 1;

  while (i < lines.length && !lines[i].startsWith('```')) {
    codeLines.push(lines[i]);
    i++;
  }

  return {
    node: {
      type: 'codeBlock',
      content: codeLines.length > 0
        ? [{ type: 'text', text: codeLines.join('\n') }]
        : [],
    },
    consumed: i + 1, // +1 for closing ```
  };
}

/**
 * Convert markdown text to TipTap JSON document
 */
export function markdownToTipTap(markdown: string): TipTapDoc {
  if (!markdown || !markdown.trim()) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    };
  }

  const lines = markdown.split('\n');
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const result = parseCodeBlock(lines.slice(i));
      if (result) {
        content.push(result.node);
        i += result.consumed;
        continue;
      }
    }

    // Bullet list
    if (/^[-*•]\s+/.test(line)) {
      const result = parseBulletList(lines.slice(i));
      content.push(result.node);
      i += result.consumed;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const result = parseOrderedList(lines.slice(i));
      content.push(result.node);
      i += result.consumed;
      continue;
    }

    // Single line parsing
    const node = parseLine(line);
    if (node) {
      content.push(node);
    }
    i++;
  }

  // Ensure we have at least one paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] });
  }

  return {
    type: 'doc',
    content,
  };
}

/**
 * Extract plain text from TipTap JSON (for search indexing)
 */
export function tipTapToPlainText(doc: TipTapDoc): string {
  const extractText = (node: TipTapNode): string => {
    if (node.text) {
      return node.text;
    }
    if (node.content) {
      return node.content.map(extractText).join('');
    }
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
      return '\n';
    }
    return '';
  };

  if (!doc.content) return '';
  return doc.content.map(extractText).join('').trim();
}
