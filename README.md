# POSH Inquiry Navigator public staging deployment

Public guidance, the integrated Guided IC/LC Inquiry staging workflow, blank Word drafts and a minimal server. The paid multi-user workspace is not activated. No confidential records, credentials, QA documents or private repository history. Use fictional selections only. No filing or real payments.

Node 22+: npm run build, npm start. Free Render staging only.

The current separate service is https://posh-inquiry-navigator-staging.onrender.com/guided. The older v25 address is not this deployment. `/health` reports the running release; it does not certify external integrations. Render currently uses its existing TCP health check.

Build verification includes software boundary tests. Additional checks: `node --test scripts/timeline.test.cjs scripts/workflow-documents.test.cjs`. Browser checks in `scripts/*-browser.cjs` require a locally installed Playwright and Chrome. The public software check mocks all enquiry submissions; it must never create real test leads.

Community: anonymous text-only questions and answers. Every post is pending until privately moderated. Backend configuration stays in server environment variables. No credentials, case data or moderation interface are published.

Razorpay checkout is test-only and disabled until the owner supplies test credentials in Render. Live keys are refused. No paid-service activation, tax invoice or real purchase is generated. Institutional plans still require a proposal/quotation.
