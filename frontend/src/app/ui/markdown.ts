/**
 * Minimal, safe Markdown → HTML for tutor answers: everything is escaped first,
 * then only code fences, inline code, bold, italics and simple lists are added.
 * The result is still passed through Angular's sanitizer by [innerHTML].
 */
export function renderMarkdown(src: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks: string[] = [];
  let text = src.replace(/```[a-zA-Z0-9+]*\n?([\s\S]*?)```/g, (_m, code: string) => {
    blocks.push(`<pre><code>${escape(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  text = escape(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const ul = /^\s*[-•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${(ul ?? ol)![1]}</li>`);
      continue;
    }
    close();
    if (/^\u0000\d+\u0000$/.test(line.trim())) out.push(line.trim());
    else if (line.trim()) out.push(`<p>${line.replace(/^#+\s*/, '')}</p>`);
  }
  close();
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_m, i: string) => blocks[+i]);
}
