export const BUSINESS_DETAILS = {
  companyName: "BluePrintAI",
  effectiveDate: "July 1, 2026",
  operatorLabel: "the BluePrintAI app operator",
  supportChannel: "the Support page in BluePrintAI or the support contact published in the Shopify App Store listing",
};

const LEGAL_PLACEHOLDERS = BUSINESS_DETAILS;
const contactSentence = `For questions or requests, use ${BUSINESS_DETAILS.supportChannel}. Include your Shopify store domain and do not send passwords, API keys, or access tokens.`;
const refundPosition =
  "BluePrintAI is currently free during its MVP/testing period. We do not currently charge users directly for access to the app. If paid Shopify billing is introduced in the future, charges, cancellations, and refunds will be handled through Shopify's billing system and according to the refund terms presented at the time of purchase.";

export const legalPages = {
  terms: {
    title: "Terms Of Service",
    eyebrow: "Terms",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "These Terms describe the rules for using BluePrintAI and the responsibilities that apply to merchant-provided content, imported data, and planning outputs.",
    sections: [
      {
        title: "Service Operator",
        body: `BluePrintAI is provided by ${LEGAL_PLACEHOLDERS.operatorLabel}. Current operator and support contact details are published through the Shopify App Store listing and the app's Support page.`,
      },
      {
        title: "App Description",
        body: "BluePrintAI is a Shopify embedded app that helps merchants organize creative records, analyze uploaded videos, generate ad briefs, create planning recommendations, and build revenue-planning blueprints from available store and workspace context.",
      },
      {
        title: "AI Wrapper Disclosure",
        body: "The app provides heuristic or analyzer-assisted creative review, planning outputs, and saved workspace records from merchant-provided content and Shopify context. Outputs require human review.",
      },
      {
        title: "Third-Party AI Providers",
        body: "Uploaded videos are sent to a separately configured analyzer service only when the owner enables and configures that integration. The current rule-based planning features do not require an external generative-AI provider.",
      },
      {
        title: "User Accounts",
        body: "Access is tied to the authenticated Shopify store and the users authorized through Shopify. You are responsible for keeping your Shopify account secure and for activity performed through your authorized workspace.",
      },
      {
        title: "User Responsibility",
        body: "You are responsible for the content, prompts, files, business data, product claims, and instructions you submit, and for reviewing all outputs before using, publishing, or relying on them.",
      },
      {
        title: "AI Output Disclaimer",
        body: "AI-generated outputs may be inaccurate, incomplete, biased, outdated, duplicative, or misleading. BluePrintAI does not guarantee sales, revenue, ROAS, ad approval, creator performance, or business outcomes.",
      },
      {
        title: "No Professional Advice",
        body: "BluePrintAI does not provide legal, medical, financial, tax, accounting, academic, advertising-platform, or other professional advice. Consult qualified professionals for decisions requiring professional judgment.",
      },
      {
        title: "Acceptable Use Summary",
        body: "You may not use BluePrintAI for illegal activity, fraud, scams, phishing, malware, spam, harassment, hateful or extremist content, sexual abuse material, nonconsensual sexual or deepfake content, impersonation, deceptive endorsements, infringement, rights-violating uploads, safety-system bypasses, or misuse of generated content.",
      },
      {
        title: "User Content And Uploaded Content",
        body: "You retain ownership of content you submit. You grant BluePrintAI and its service providers a limited license to host, process, transmit, analyze, and display that content only as needed to provide, secure, improve, and support the service.",
      },
      {
        title: "Intellectual Property",
        body: "BluePrintAI, its design, software, workflows, names, and documentation are owned by the app operator or its licensors. You may not copy, modify, reverse engineer, or misuse the app except as allowed by law or a written agreement.",
      },
      {
        title: "Billing, Subscriptions, Trials, Cancellations, And Refunds",
        body: refundPosition,
      },
      {
        title: "Third-Party Services",
        body: "The app depends on Shopify, hosting providers, databases, storage, analytics if later enabled, AI providers, Google Ads when a merchant authorizes it, and other subprocessors. Third-party services may have their own terms and privacy practices.",
      },
      {
        title: "Service Availability",
        body: "BluePrintAI may be modified, interrupted, suspended, limited, or discontinued. Maintenance, third-party outages, provider limits, or security issues may affect availability.",
      },
      {
        title: "Warranty Disclaimer",
        body: "BluePrintAI is provided on an as-available basis. To the extent permitted by applicable law, the app operator disclaims warranties not expressly stated in these Terms, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
      },
      {
        title: "Limitation Of Liability",
        body: "To the extent permitted by applicable law, the app operator is not responsible for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or business opportunities arising from use of the app or reliance on its outputs.",
      },
      {
        title: "Indemnification",
        body: "You are responsible for your content, imports, product claims, advertising decisions, and compliance obligations. Where permitted by applicable law, you agree to be responsible for claims arising from your unlawful use of the app or violation of these Terms or third-party rights.",
      },
      {
        title: "Termination And Suspension",
        body: "We may suspend or terminate access if you violate these Terms, create risk for the app, other users, Shopify, providers, or the public, or if required by law, Shopify, or provider policy.",
      },
      {
        title: "Governing Law",
        body: "These Terms are governed by the laws that apply to the app operator and the merchant, without overriding any mandatory rights available under applicable law.",
      },
      {
        title: "Dispute Resolution",
        body: `Please contact ${LEGAL_PLACEHOLDERS.supportChannel} first so the parties can try to resolve a concern informally. Any unresolved dispute will be handled under applicable law and any mandatory venue or consumer-protection rules.`,
      },
      {
        title: "Changes To Terms",
        body: "We may update these Terms from time to time. The updated effective date will identify the current version. Continued use after changes means you accept the revised Terms.",
      },
      {
        title: "Contact Information",
        body: contactSentence,
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Privacy",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "This Privacy Policy explains the information BluePrintAI processes, why it is used, and the choices available to Shopify merchants.",
    sections: [
      {
        title: "Information We Collect",
        body: "We collect information you provide, information generated through your use of the app, information from Shopify as needed for app functionality, and technical information from devices, browsers, servers, and logs.",
      },
      {
        title: "Account Data",
        body: "Account data may include Shopify store domain, workspace settings, authorized user context from Shopify, onboarding profile fields, plan or billing status, support requests, and app activity records.",
      },
      {
        title: "Google Ads Authorization And Data",
        body: "Google Ads data is accessed only after a merchant authorizes BluePrintAI. The app stores the connection per Shopify store, protects the refresh token server-side, and does not persist Google access tokens. Authorized users can disconnect Google Ads from Connections. Synced Google Ads metrics remain identified as connected-platform data and are distinct from manual, CSV-imported, and clearly labeled demo data; demo or fabricated metrics are not presented as Google Ads results.",
      },
      {
        title: "Prompt And Input Data",
        body: "Prompt and input data may include product context, creative notes, planning instructions, generated-workflow parameters, search text, and other text you enter into the app.",
      },
      {
        title: "Uploaded Files And Content",
        body: "Uploaded content may include videos, file names, file metadata, thumbnails, transcripts, creative records, product or creator notes, CSV import content, and related analysis metadata.",
      },
      {
        title: "AI-Generated Outputs",
        body: "We may store generated summaries, creative analysis, recommendations, ad briefs, revenue blueprints, scores, suggested scripts, and other outputs so they can be displayed, saved, audited, supported, and improved.",
      },
      {
        title: "Payment And Billing Data",
        body: "BluePrintAI is free during its current review and trial period and does not collect payment-card data. If paid plans are introduced, billing will be handled through Shopify and this policy and the applicable pricing terms will be updated before charges begin.",
      },
      {
        title: "Device And Log Data",
        body: "We may collect IP address, browser type, device details, timestamps, request URLs, app errors, security events, session metadata, and performance logs.",
      },
      {
        title: "Cookies And Analytics",
        body: "The app may use essential cookies or session technologies required for Shopify authentication and app security. Analytics or marketing cookies may be added later only if configured and disclosed in the Cookie Policy.",
      },
      {
        title: "How We Use Information",
        body: "We use information to provide the app, authenticate sessions, generate and save outputs, process uploads, support users, secure the service, debug issues, improve quality, enforce policies, comply with law, and manage billing or subscriptions.",
      },
      {
        title: "AI Provider Processing Disclosure",
        body: "Prompts, uploaded files, product context, creative metadata, and outputs may be sent to third-party AI providers for processing. Do not submit sensitive personal information unless necessary for your intended use.",
      },
      {
        title: "Third-Party Service Providers And Subprocessors",
        body: "We use Shopify for authentication and app delivery, our hosting and database providers for operating the service, private object storage for uploaded media, and Google only when a merchant explicitly authorizes Google Ads. The current service does not require an external generative-AI provider for its heuristic review and rule-based planning features. We update this policy before adding a provider that materially changes data processing.",
      },
      {
        title: "Data Retention",
        body: "The app stores shop-scoped workspace records and uploaded media while needed to provide the service. Verified Shopify app-uninstalled and shop-redact webhooks invoke the app's workspace and session deletion flow. Limited records may be retained when required for security, fraud prevention, legal compliance, or resolving disputes, subject to applicable law.",
      },
      {
        title: "Data Deletion Requests",
        body: `Uninstalling the app triggers the app's shop-scoped workspace and session deletion flow. Shopify shop-redact requests use the same deletion flow. To request deletion while the app remains installed, use ${LEGAL_PLACEHOLDERS.supportChannel}.`,
      },
      {
        title: "User Privacy Rights",
        body: `Depending on applicable law, you may request access, correction, deletion, restriction, or a copy of eligible personal information. Use ${LEGAL_PLACEHOLDERS.supportChannel}; requests may require verification of the relevant Shopify store and requester authority.`,
      },
      {
        title: "Children And Age Restrictions",
        body: "BluePrintAI is intended for business users and is not directed to children. Do not use the app if you are under the age required to use Shopify or enter binding agreements in your jurisdiction.",
      },
      {
        title: "International Data Transfers",
        body: "BluePrintAI and its service providers may process information in countries other than the merchant's location. Where required, the app operator uses appropriate contractual or legal safeguards for those transfers.",
      },
      {
        title: "Security Safeguards",
        body: "We use reasonable administrative, technical, and organizational safeguards designed to protect information. No system is completely secure, and we cannot guarantee absolute security.",
      },
      {
        title: "Breach And Contact Procedure",
        body: `Use ${LEGAL_PLACEHOLDERS.supportChannel} for security, privacy, or data-protection questions. The app operator will investigate reported incidents and provide notices when required by applicable law.`,
      },
      {
        title: "Changes To Policy",
        body: "We may update this Privacy Policy from time to time. The effective date will identify the current version.",
      },
      {
        title: "Contact Information",
        body: contactSentence,
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    eyebrow: "Cookies",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "This Cookie Policy explains how BluePrintAI may use cookies and similar technologies. Vendor-specific disclosures should be updated whenever analytics, marketing pixels, or tracking services are added.",
    sections: [
      {
        title: "Essential Cookies",
        body: "Essential cookies and similar session technologies may be used for Shopify authentication, embedded app routing, security, fraud prevention, request handling, and remembering settings required for the app to work.",
      },
      {
        title: "Analytics Cookies",
        // TODO: If analytics is enabled later, name each vendor and document cookie purpose, retention, and opt-out controls.
        body: "No analytics or pixel vendor was detected in the current app code during this implementation pass. If analytics is added later, list each vendor, purpose, retention period, and opt-out path here.",
      },
      {
        title: "Marketing And Tracking Cookies",
        body: "Marketing or retargeting cookies are not currently described as active in the app code. If marketing pixels are added later, update this policy and consent controls before enabling them.",
      },
      {
        title: "Shopify And Session Cookies",
        body: "Because BluePrintAI is a Shopify embedded app, Shopify and app-session cookies or equivalent storage may be used to authenticate users, maintain app sessions, protect requests, and connect the app to the current Shopify store.",
      },
      {
        title: "How Users Can Control Cookies",
        body: "Users can control cookies through browser settings and, where available, platform or app consent tools. Blocking essential cookies may prevent the app from working correctly.",
      },
      {
        title: "Future Cookie Banner Support",
        body: "If non-essential analytics or marketing cookies are added, BluePrintAI should add a cookie banner or preference center before those cookies run, where required by law.",
      },
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    eyebrow: "Acceptable Use",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "This policy describes prohibited uses of BluePrintAI, including prohibited prompts, uploads, generated content workflows, and attempts to misuse the app.",
    sections: [
      {
        title: "Illegal Activity",
        body: "Do not use the app to violate laws, regulations, sanctions, platform rules, court orders, or the rights of others.",
      },
      {
        title: "Fraud, Scams, And Phishing",
        body: "Do not create deceptive offers, phishing messages, impersonation flows, credential theft, fake support messages, scams, or fraudulent business practices.",
      },
      {
        title: "Malware Or Security Abuse",
        body: "Do not develop, distribute, or facilitate malware, exploit code, credential stuffing, vulnerability abuse, unauthorized access, or attacks against systems.",
      },
      {
        title: "Spam",
        body: "Do not generate, automate, or distribute unsolicited bulk messaging, abusive outreach, or manipulative engagement.",
      },
      {
        title: "Harassment Or Abuse",
        body: "Do not use the app to harass, threaten, bully, dox, shame, exploit, or abuse individuals or groups.",
      },
      {
        title: "Hate Or Violent Extremism",
        body: "Do not promote hate, dehumanization, extremist recruitment, violent ideology, or targeted abuse based on protected characteristics.",
      },
      {
        title: "Child Sexual Exploitation Material",
        body: "Do not upload, request, create, transform, describe, facilitate, or distribute child sexual exploitation or abuse material.",
      },
      {
        title: "Nonconsensual Sexual Or Deepfake Content",
        body: "Do not create or request nonconsensual sexual content, intimate deepfakes, sexualized impersonations, or sexual exploitation content.",
      },
      {
        title: "Impersonation",
        body: "Do not impersonate people, brands, platforms, government entities, creators, customers, or merchants in a deceptive or unauthorized way.",
      },
      {
        title: "Deceptive Reviews Or Fake Endorsements",
        body: "Do not generate fake reviews, fake testimonials, undisclosed endorsements, fabricated influencer claims, or deceptive social proof.",
      },
      {
        title: "Copyright Infringement",
        body: "Do not upload, request, or generate content that infringes copyrights, trademarks, publicity rights, privacy rights, or other intellectual property rights.",
      },
      {
        title: "Rights-Violating Uploads",
        body: "Do not upload files, product data, customer data, creator content, or confidential materials unless you have the rights and permissions needed to use them with the app and its providers.",
      },
      {
        title: "Professional Advice Misuse",
        body: "Do not treat outputs as legal, medical, financial, tax, academic, safety, employment, or other professional advice.",
      },
      {
        title: "Bypassing Safety Systems",
        body: "Do not attempt to bypass, disable, probe, or manipulate safety systems, rate limits, authentication, policy controls, or provider restrictions.",
      },
      {
        title: "Misuse Of AI-Generated Content",
        body: "Do not publish or rely on AI-generated content without human review, rights review, claims substantiation, platform compliance review, and appropriate disclosures where required.",
      },
    ],
  },
  "refund-policy": {
    title: "Refund And Cancellation Policy",
    eyebrow: "Refunds",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      refundPosition,
    sections: [
      {
        title: "Current MVP Testing Period",
        body: "BluePrintAI is currently free during its MVP/testing period. We do not currently charge users directly for access to the app.",
      },
      {
        title: "Future Shopify Billing",
        body: "If paid Shopify billing is introduced in the future, charges, cancellations, and refunds will be handled through Shopify's billing system and according to the refund terms presented at the time of purchase.",
      },
      {
        title: "Cancellations",
        body: "Because BluePrintAI is currently free during testing, there is no paid subscription to cancel through BluePrintAI at this time. If paid billing is introduced, cancellation instructions will be shown in the Shopify billing flow or related plan screen.",
      },
      {
        title: "Refund Eligibility",
        body: "Because BluePrintAI is currently free during its MVP/testing period, there are no direct BluePrintAI user charges to refund. Future refund eligibility will follow the terms presented at the time of purchase and Shopify's billing process.",
      },
      {
        title: "Usage-Based And Digital Service Limits",
        body: "If paid features are introduced later, BluePrintAI may provide digital services, AI processing, stored outputs, and upload workflows. Any future usage-based or digital-service refund limits will be disclosed before purchase.",
      },
      {
        title: "Contact Support",
        body: `For billing, cancellation, or refund questions, use ${LEGAL_PLACEHOLDERS.supportChannel} with your Shopify store domain, plan details, and request summary.`,
      },
    ],
  },
  "ai-disclaimer": {
    title: "AI Disclaimer",
    eyebrow: "AI Disclosure",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "BluePrintAI uses AI-assisted systems to generate summaries, analysis, recommendations, briefs, and planning outputs. Human review is required.",
    sections: [
      {
        title: "Use Of AI And Third-Party Systems",
        body: "BluePrintAI uses AI and may send prompts, uploads, metadata, and outputs to third-party AI systems or processing providers to provide the service.",
      },
      {
        title: "Output Limitations",
        body: "Outputs may be inaccurate, incomplete, biased, outdated, misleading, duplicative, or unsuitable for your use case.",
      },
      {
        title: "Human Review Required",
        body: "Review all outputs before relying on them, publishing them, giving them to creators, using them in ads, changing business plans, or making decisions.",
      },
      {
        title: "User Responsibility",
        body: "You are responsible for how you use generated content, including claims substantiation, rights review, platform compliance, legal compliance, and brand review.",
      },
      {
        title: "No Professional Advice",
        body: "The app does not provide legal, medical, financial, tax, academic, advertising-platform, or other professional advice.",
      },
      {
        title: "Sensitive Information",
        body: "Do not upload sensitive personal information, confidential files, or regulated data unless necessary and authorized for your intended use.",
      },
      {
        title: "Business Planning Outputs",
        body: "Business recommendations, ad briefs, revenue suggestions, creative analysis, planning scores, and similar outputs are informational only and do not guarantee performance, revenue, ROAS, sales, approvals, or outcomes.",
      },
    ],
  },
  copyright: {
    title: "Copyright And DMCA Policy",
    eyebrow: "Copyright",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "This policy describes user content rights, AI output limitations, and the copyright contact path for BluePrintAI.",
    sections: [
      {
        title: "Rights To Uploaded Content",
        body: "You must own, control, license, or otherwise have the rights and permissions needed to upload and process content through BluePrintAI.",
      },
      {
        title: "Limited Processing License",
        body: "You grant BluePrintAI and its providers a limited license to host, transmit, analyze, transform, and display your content only as needed to provide, secure, support, and improve the service.",
      },
      {
        title: "AI Outputs May Not Be Unique",
        body: "AI-generated outputs may be similar or identical to outputs generated for other users, public material, or common advertising patterns.",
      },
      {
        title: "No Copyright-Safety Guarantee",
        body: "BluePrintAI does not guarantee that AI outputs are original, unique, non-infringing, registrable, or safe to publish. You are responsible for rights review before use.",
      },
      {
        title: "DMCA And Copyright Contact Process",
        body: `Copyright takedown notices, counter-notices, and copyright questions should be submitted through ${LEGAL_PLACEHOLDERS.supportChannel}. Include the work at issue, the location of the allegedly infringing material, your contact information, and enough detail for BluePrintAI to review the request.`,
      },
      {
        title: "Repeat Infringer Policy",
        body: "BluePrintAI may suspend or terminate users or workspaces that repeatedly infringe or repeatedly upload rights-violating content.",
      },
    ],
  },
  contact: {
    title: "Contact",
    eyebrow: "Contact",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "Use this page for support, legal, privacy, copyright, and data deletion request routing.",
    sections: [
      {
        title: "Support Requests",
        body: `Use ${LEGAL_PLACEHOLDERS.supportChannel}. Include your Shopify store domain, the page or workflow involved, and a short description of the issue. Do not send passwords, API keys, access tokens, or unnecessary sensitive information.`,
      },
      {
        title: "Legal And Privacy Contact",
        body: `Legal, copyright, privacy, and data-protection questions can be submitted through ${LEGAL_PLACEHOLDERS.supportChannel}.`,
      },
      {
        title: "Operator Details",
        body: "Current app-operator and support details are published in the Shopify App Store listing.",
      },
      {
        title: "Official Support Channel",
        body: `Use ${LEGAL_PLACEHOLDERS.supportChannel}.`,
      },
      {
        title: "Service Name",
        body: LEGAL_PLACEHOLDERS.companyName,
      },
      {
        title: "Privacy And Data Deletion Requests",
        body: `For privacy or data deletion requests, use ${LEGAL_PLACEHOLDERS.supportChannel}. Include your Shopify store domain and enough detail to identify the relevant workspace and records.`,
      },
    ],
  },
  "data-deletion": {
    title: "Data Deletion",
    eyebrow: "Privacy Request",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "This page explains the deletion mechanisms that are visible in the current app code.",
    sections: [
      {
        title: "Uninstalling BluePrintAI",
        body: "When Shopify sends a verified app-uninstalled webhook, the app deletes the shop-scoped BluePrintAI workspace records, uploaded media, and Shopify sessions handled by its deletion flow.",
      },
      {
        title: "Shopify Redaction Requests",
        body: "When Shopify sends a verified shop-redact webhook, the app invokes the same shop-scoped workspace and session deletion flow.",
      },
      {
        title: "Requesting Deletion While Installed",
        body: `The app does not currently provide a user-facing control that deletes the entire workspace while it remains installed. To request deletion, use ${LEGAL_PLACEHOLDERS.supportChannel} and include the Shopify store domain needed to identify the workspace. Do not send passwords, API keys, or access tokens.`,
      },
      {
        title: "Request Handling",
        body: "Deletion requests are verified against the relevant Shopify store before action is taken. Requests are handled within the time required by applicable law; timing can vary when additional verification is needed.",
      },
    ],
  },
};

export const legalNavItems = [
  { label: "Terms", to: "/terms", pageId: "terms" },
  { label: "Privacy", to: "/privacy", pageId: "privacy" },
  { label: "Cookies", to: "/cookies", pageId: "cookies" },
  { label: "Acceptable Use", to: "/acceptable-use", pageId: "acceptable-use" },
  { label: "Refund Policy", to: "/refund-policy", pageId: "refund-policy" },
  { label: "AI Disclaimer", to: "/ai-disclaimer", pageId: "ai-disclaimer" },
  { label: "Copyright", to: "/copyright", pageId: "copyright" },
  { label: "Contact", to: "/contact", pageId: "contact" },
  { label: "Support", to: "/support", pageId: "support" },
  { label: "Data Deletion", to: "/data-deletion", pageId: "data-deletion" },
];
