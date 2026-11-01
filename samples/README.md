# Sample documents

These are original fictional test documents created for this project. Each PDF
has a text layer and two pages; neither contains real customer information.
The matching `.txt` files provide an alternative for testing text uploads.
Regenerate them with `npm run samples:generate`.

| Document | Example question | Expected facts |
| --- | --- | --- |
| `riverbend-operations.pdf` | What are the opening hours and laptop loan rules? | Weekdays 08:30–16:30 SAST; form RB-204; seven calendar days. |
| `riverbend-operations.pdf` | Compare the two meeting rooms. | Cedar holds eight people; Acacia holds twelve. |
| `riverbend-product-faq.pdf` | Compare the plans and explain the refund window. | Starter R120/month and 20 documents; Team R350/month and 100 documents; first-payment refund request within 14 calendar days. |

Upload both PDFs. Select both for a cross-document question such as “What are
the office opening hours and how much is the Team plan?” Expect citations
from both documents when those passages are retrieved. Open each footnote
and compare its text with the original PDF. Reopen the conversation and
confirm the citations and generated title remain visible.

Then start a conversation with only the Product FAQ and ask which form is
needed for a laptop loan. It should explain that the selected excerpts do not
supply the form number, rather than use the unselected handbook. The FAQ
does not specify annual billing; ask about that to test an unsupported question.
