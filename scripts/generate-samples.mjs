import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Original fictional text, intentionally long enough to exercise overlapping chunks.
const documents = [
  {
    slug: 'riverbend-operations', title: 'Riverbend Operations Handbook',
    sections: [
      'FICTIONAL TEST DOCUMENT. Riverbend Research Cooperative is an invented organization. These policies are sample facts for testing document retrieval, not instructions for a real organization.',
      '1. Opening hours and support. The Riverbend office opens Monday through Friday from 08:30 to 16:30 South African Standard Time. The office is closed on weekends. The help desk uses extension 204. Routine requests receive an initial response within two working days. An initial response acknowledges a ticket and is not a promise that the issue has already been resolved.',
      'The daily opening checklist is assigned to the duty coordinator. Before the first meeting, the coordinator checks the visitor book, unlocks the shared project room, and confirms that the document scanner has paper. At closing, the coordinator saves the handover note and locks the project room. The handover note records unfinished tasks without including passwords or private customer information.',
      '2. Equipment loans. A laptop can be borrowed for seven calendar days. The borrower completes form RB-204 and obtains approval from the operations coordinator before collecting the laptop. The form records the asset number, collection date, expected return date, and the borrower name. Equipment must be checked in with the coordinator; leaving a device on an empty desk does not complete a return.',
      'An extension can be requested before the existing return date. The coordinator checks whether another person has reserved the laptop before granting an extension. Damage or loss must be reported to the help desk on the same working day that it is noticed. A report should describe the asset number and what happened without guessing about the cause.',
      '3. Document handling. Every uploaded research document should have a descriptive filename and a short owner note. The owner note explains the document purpose and the team responsible for keeping it current. A revised document is uploaded as a new version for this demonstration. Existing assistant citations retain the text of the passage used when the response was saved.',
      'The cooperative distinguishes original evidence from summaries. Meeting notes can summarize a discussion, but the original approved policy remains the source of a policy claim. If a response cites an unrelated passage, the reviewer should ask a narrower question or select the correct document rather than assume that a numbered citation proves the answer is accurate.',
      '4. Meeting rooms. The Cedar room holds eight people and the Acacia room holds twelve people. A room reservation can last up to two hours. Reservations use the shared schedule and should include the meeting purpose, start time, and organizer. A cancellation should be recorded as soon as the organizer knows that the room is no longer needed.',
      'Video calls should use headphones when other meetings are taking place nearby. The last person leaving a room returns the chairs, removes printed drafts, and clears the whiteboard unless the next team has explicitly asked to preserve it. These room procedures apply to internal meetings and are separate from the equipment loan rules.',
      '5. Training and review. New coordinators complete a supervised opening shift and a supervised closing shift before taking an independent duty. The supervisor reviews the checklist with the trainee and records any unclear steps. The handbook is reviewed once per quarter. Proposed changes are collected in a review log and do not become policy until the coordinator publishes an approved revision.',
      '6. Limits of this source. This handbook does not specify customer subscription prices, product refund rules, or payment methods. Those facts are in the separate Riverbend Product FAQ. A question about a topic missing from the selected document should receive an explicit statement that the available passages do not provide that information.',
      'Testing questions: What are the office opening hours? Which form is needed to borrow a laptop? How long is a laptop loan? Compare the Cedar and Acacia room capacities. Expected source facts: 08:30 to 16:30 SAST; form RB-204; seven calendar days; eight and twelve people respectively.',
    ],
  },
  {
    slug: 'riverbend-product-faq', title: 'Riverbend Product FAQ',
    sections: [
      'FICTIONAL TEST DOCUMENT. Riverbend Notes is an invented document research product. All names, prices, and policies below are synthetic examples for testing retrieval and source citations. No service is being sold by this sample document.',
      '1. Product overview. Riverbend Notes helps a small team ask questions about selected documents. A team member uploads readable PDF or text documents, chooses the sources for a conversation, and asks a question in ordinary language. Replies can include numbered citations. Opening a citation reveals the original document passage used for that answer.',
      'The demonstration emphasizes traceability. A useful answer should explain the relevant fact and show which passage supports it. A citation is a pointer to evidence, not a guarantee that the model has interpreted the evidence correctly. Reviewers should read the expanded passage when checking an important claim or resolving an apparent contradiction.',
      '2. Sample plans. The Starter plan costs R120 per month and includes 20 documents. The Team plan costs R350 per month and includes 100 documents. These amounts are fictional South African rand prices and are quoted per month. The sample plans do not describe annual billing, discounts, taxes, or an enterprise contract.',
      'A team should choose a plan according to the number of documents it needs to keep available, not the length of a single assistant response. If someone asks for a feature or price that is not listed here, the correct research response is to explain that this FAQ does not supply that fact. It should not extrapolate a larger plan from the two examples.',
      '3. Refund policy. A first-time customer may request a refund within 14 calendar days of the first payment. The request is submitted to the product support desk with the payment reference. The support desk acknowledges the request within three working days. An acknowledgement is separate from the final review outcome.',
      'The fictional refund rule is limited to a first payment. This FAQ does not state a refund entitlement for later renewals or explain how a bank handles a reversed transaction. A reviewer testing source grounding should ask a follow-up about one of these missing details and check that the assistant does not invent an additional condition or promise.',
      '4. Document support. Accepted file extensions are .pdf and .txt. A PDF must contain readable text; a scanned image without a text layer needs OCR before upload. The upload limit is 4 MiB per file. An uploaded file may contain no more than 200 PDF pages, and extracted text may contain no more than 500,000 characters or 250 chunks in this demonstration.',
      'Text is split into approximately 500-token chunks with 50-token overlap. The overlap gives nearby chunks some shared context when a useful sentence falls close to a boundary. Embeddings use 1536 dimensions. These processing details describe this demonstration and should not be generalized to every retrieval system or every embedding model.',
      '5. Conversations and history. Select between one and ten documents before asking the first question. That selection stays fixed for the conversation. To use a different collection, start a new conversation. The conversation list shows a short generated title and a timestamp. A generated title contains at most six words and can fall back to words from the first question if the title service is unavailable.',
      'Reopening a saved conversation loads its messages and cited source text. Each reply has its own source numbering, so source 1 in one reply is not necessarily source 1 in a later reply. Saving source text with the message lets a reviewer inspect the evidence that was present when that response was written.',
      '6. Limits of this source. This FAQ does not list office opening hours, meeting room sizes, or the equipment loan form. Those facts appear in the Riverbend Operations Handbook. Use both documents for a comparison question and only the FAQ when checking that handbook-only information is not introduced into the answer.',
      'Testing questions: Compare the two plan prices and document allowances. How long is the refund window? Does the FAQ promise annual billing? Expected facts: Starter R120 and 20 documents; Team R350 and 100 documents; refund request within 14 calendar days; annual billing is not specified.',
    ],
  },
];

function escapePdf(text) { return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function wrap(text, width = 88) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
}

function createPdf(document) {
  const lines = document.sections.flatMap(section => [...wrap(section), '']);
  const pages = [];
  while (lines.length) pages.push(lines.splice(0, 43));
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    const stream = `BT\n/F1 16 Tf\n50 790 Td\n(${escapePdf(document.title)}) Tj\n/F1 9 Tf\n0 -20 Td\n(Page ${index + 1} of ${pages.length} - fictional test material) Tj\n/F1 10 Tf\n15 TL\n0 -30 Td\n${page.map(line => `(${escapePdf(line)}) Tj\nT*`).join('\n')}\nET\n`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`;
  });
  let result = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(result, 'ascii');
    result += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result, 'ascii');
  result += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  result += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  result += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result, 'ascii');
}

const destination = fileURLToPath(new URL('../samples/', import.meta.url));
mkdirSync(destination, { recursive: true });
for (const document of documents) {
  writeFileSync(`${destination}/${document.slug}.pdf`, createPdf(document));
  writeFileSync(`${destination}/${document.slug}.txt`, `${document.title}\n\n${document.sections.join('\n\n')}\n`);
  console.log(`Generated ${document.slug}.pdf and .txt`);
}
