const MAX_PDF_BYTES = 30 * 1024 * 1024; // 30MB — a generous cap for a research paper
const MAX_EXTRACTED_CHARS = 60000; // enough for a real summary; keeps prompt/latency bounded

/**
 * Downloads a PDF and extracts its actual text (every page, not just an
 * abstract). Returns '' on any failure that isn't the caller's fault — a
 * scanned/image-only PDF, a dead link, a size cap — so callers can fall back
 * to whatever metadata they already have instead of throwing.
 */
async function fetchPdfText(pdfUrl) {
  if (!pdfUrl) return '';
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'Ananta-Quantum-Studio/1.0 (research reader)' }
    });
    if (!res.ok) return '';

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) return '';
    if (buf.length < 4 || buf.toString('ascii', 0, 4) !== '%PDF') return ''; // not actually a PDF

    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buf);
    return (data.text || '').trim();
  } catch (e) {
    console.warn('[extractText] PDF extraction notice for', pdfUrl, ':', e.message);
    return '';
  }
}

/**
 * Downloads a web page or research paper and extracts readable text.
 * Uses native fetch and regex/HTML parsing. Special handling for arXiv abstracts and PDFs.
 * @param {string} url
 * @returns {Promise<{title: string, text: string}>}
 */
async function extractTextFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Valid URL is required');
  }

  const cleanUrl = url.trim();

  // If this is an arXiv URL (pdf or abs), query arXiv's API for the structured abstract
  const arxivMatch = cleanUrl.match(/arxiv\.org\/(?:pdf|abs)\/([0-9]+\.[0-9]+(?:v\d+)?|[a-z\-]+(?:\.[a-z]+)?\/\d+)/i);
  if (arxivMatch) {
    const arxivId = arxivMatch[1].replace(/\.pdf$/i, '');
    try {
      const apiUrl = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        const xml = await apiRes.text();
        const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
        const entryXml = entryMatch ? entryMatch[1] : xml;

        const titleM = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
        const sumM = entryXml.match(/<summary>([\s\S]*?)<\/summary>/i);
        const authorsM = [...entryXml.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/gi)].map(m => m[1].trim());
        const dateM = entryXml.match(/<published>([\s\S]*?)<\/published>/i);

        let title = titleM ? titleM[1].replace(/\s+/g, ' ').trim() : `arXiv:${arxivId}`;
        title = title.replace(/^\s*arXiv\s*Query:[^;]+;/i, '').trim();
        const summary = sumM ? sumM[1].replace(/\s+/g, ' ').trim() : '';
        const authors = authorsM.length ? authorsM.join(', ') : 'Researchers in Quantum Science';
        const date = dateM ? dateM[1].substring(0, 10) : '';

        // The abstract alone is not the paper — fetch the actual PDF body.
        // Every arXiv id has a PDF at this exact URL, so this is not a guess.
        const pdfBody = await fetchPdfText(`https://arxiv.org/pdf/${arxivId}`);

        const header = `Title: ${title}\nAuthors: ${authors}\nPublished: ${date}\narXiv Identifier: ${arxivId}\n\nAbstract:\n${summary}`;
        const fullText = pdfBody
          ? `${header}\n\nFull Paper Text:\n${pdfBody}`.slice(0, MAX_EXTRACTED_CHARS)
          : `${header}\n\n(Could not extract the full PDF body — this paper may be a scanned image, or the PDF was unreachable. Summary below is based on the abstract only.)`;

        return { title, text: fullText, fullTextAvailable: Boolean(pdfBody) };
      }
    } catch (e) {
      console.warn('[extractText] arXiv API lookup notice:', e.message);
    }
  }

  // General web page extraction using native fetch
  const response = await fetch(cleanUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (cleanUrl.toLowerCase().endsWith('.pdf') || contentType.includes('application/pdf')) {
    const fallbackTitle = decodeURIComponent(cleanUrl.split('/').pop() || '').replace(/\.pdf$/i, '') || 'Research PDF Document';
    const pdfBody = await fetchPdfText(cleanUrl);
    if (!pdfBody) {
      throw new Error('Could not extract text from this PDF (unreachable, too large, or a scanned image with no text layer)');
    }
    // The PDF's own title (first non-empty line) usually reads better than a
    // URL-derived filename slug.
    const firstLine = pdfBody.split('\n').map(l => l.trim()).find(l => l.length > 4 && l.length < 200);
    return { title: firstLine || fallbackTitle, text: pdfBody.slice(0, MAX_EXTRACTED_CHARS), fullTextAvailable: true };
  }

  const html = await response.text();

  // Extract title
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = titleM ? titleM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : 'Research Article';

  // Strip script, style, nav, footer, header tags
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (m, code) => String.fromCodePoint(parseInt(code, 10))) // numeric entities: &#8211; -> –
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16))) // hex entities: &#x2013; -> –
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, '&') // must run after numeric decoding, and last among named entities (it would otherwise mangle them, e.g. turning &amp;lt; into &lt;)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > MAX_EXTRACTED_CHARS) {
    cleaned = cleaned.substring(0, MAX_EXTRACTED_CHARS);
  }

  // Some DOI-registered records (lab protocols, dataset landing pages, JS-
  // rendered SPAs) return almost no server-rendered text — a title and
  // little else. That is not "the full paper", and claiming otherwise is
  // exactly the dishonesty this function was rewritten to stop doing.
  const MIN_CREDIBLE_CHARS = 400;
  return { title, text: cleaned, fullTextAvailable: cleaned.length >= MIN_CREDIBLE_CHARS };
}

module.exports = { extractTextFromUrl, fetchPdfText };
