export const LEGAL_PLACEHOLDERS = {
  address: "972 New Dover Rd",
  companyName: "BluePrintAI",
  effectiveDate: "June 23, 2026",
  governingLaw:
    "the applicable laws and venue determined by the operator of BluePrintAI, subject to legal review",
  legalEntityStatus: "Not currently registered as an LLC or corporation",
  supportEmail: "mohammedzabbasi@gmail.com",
  website: "https://blueprintaiapp.com",
};

const contactSentence = `Questions can be sent to ${LEGAL_PLACEHOLDERS.supportEmail} or mailed to ${LEGAL_PLACEHOLDERS.address}.`;
const refundPosition =
  "BluePrintAI is currently free during its MVP/testing period. We do not currently charge users directly for access to the app. If paid Shopify billing is introduced in the future, charges, cancellations, and refunds will be handled through Shopify's billing system and according to the refund terms presented at the time of purchase.";

export const legalPages = {
  terms: {
    title: "Terms Of Service",
    eyebrow: "Terms",
    updated: LEGAL_PLACEHOLDERS.effectiveDate,
    intro:
      "These Terms of Service describe the rules for using BluePrintAI. BluePrintAI is currently operated as an unregistered project/business. BluePrintAI is not currently a registered LLC or corporation. Any references to BluePrintAI, we, us, or our refer to the operator of the BluePrintAI application.",
    sections: [
      {
        title: "Business And Legal Entity Status",
        body: `${LEGAL_PLACEHOLDERS.legalEntityStatus}. BluePrintAI is currently operated as an unregistered project/business. Any references to BluePrintAI, we, us, or our refer to the operator of the BluePrintAI application. The official website is ${LEGAL_PLACEHOLDERS.website}.`,
      },
      {
        title: "App Description",
        body: "BluePrintAI is a Shopify embedded app that helps merchants organize creative records, analyze uploaded videos, generate ad briefs, create planning recommendations, and build revenue-planning blueprints from available store and workspace context.",
      },
      {
        title: "AI Wrapper Disclosure",
        body: "BluePrintAI wraps AI-assisted workflows around merchant-provided data, uploaded content, saved app records, and Shopify context. The app does not replace human judgment, professional services, or platform compliance review.",
      },
      {
        title: "Third-Party AI Providers",
        body: "Prompts, uploaded files, product context, creative metadata, and generated outputs may be sent to third-party AI providers or processing services to provide the service. Provider availability, behavior, and model outputs may change.",
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
        body: `BluePrintAI, its design, software, workflows, names, and documentation are owned by the operator of ${LEGAL_PLACEHOLDERS.companyName} or its licensors. You may not copy, modify, reverse engineer, or misuse the app except as allowed by law or a written agreement.`,
      },
      {
        title: "Billing, Subscriptions, Trials, Cancellations, And Refunds",
        body: refundPosition,
      },
      {
        title: "Third-Party Services",
        body: "The app depends on Shopify, hosting providers, databases, storage, analytics if later enabled, AI providers, and other subprocessors. Third-party services may have their own terms and privacy practices.",
      },
      {
        title: "Service Availability",
        body: "BluePrintAI may be modified, interrupted, suspended, limited, or discontinued. Maintenance, third-party outages, provider limits, or security issues may affect availability.",
      },
      {
        title: "Warranty Disclaimer",
        body: "The service is provided as is and as available, without warranties of any kind to the fullest extent permitted by law. We do not warrant that outputs will be accurate, unique, uninterrupted, secure, compliant, or error-free.",
      },
      {
        title: "Limitation Of Liability",
        body: "To the fullest extent permitted by law, BluePrintAI and its owners, employees, contractors, and providers will not be liable for indirect, incidental, special, consequential, exemplary, or lost-profit damages, or for decisions made using AI outputs.",
      },
      {
        title: "Indemnification",
        body: "You agree to defend, indemnify, and hold BluePrintAI harmless from claims arising from your content, uploads, prompts, use of outputs, violation of these Terms, infringement, unlawful conduct, or misuse of the service.",
      },
      {
        title: "Termination And Suspension",
        body: "We may suspend or terminate access if you violate these Terms, create risk for the app, other users, Shopify, providers, or the public, or if required by law, Shopify, or provider policy.",
      },
      {
        title: "Governing Law",
        body: `These Terms are governed by ${LEGAL_PLACEHOLDERS.governingLaw}, excluding conflict-of-law rules where applicable.`,
      },
      {
        title: "Dispute Resolution",
        body: "Dispute resolution process, venue, arbitration, class-action waiver, informal resolution period, and exceptions should be reviewed by counsel before any paid launch or business registration change.",
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
      "This Privacy Policy explains how BluePrintAI collects, uses, shares, retains, and protects information. BluePrintAI is currently operated as an unregistered project/business and is not currently a registered LLC or corporation.",
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
        title: "Prompt And Input Data",
        body: "Prompt and input data may include product context, creative notes, planning instructions, generated-workflow parameters, search text, and other text you enter into the app.",
      },
      {
        title: "Uploaded Files And Content",
        body: "Uploaded content may include videos, file names, file metadata, thumbnails, transcripts, creative records, product or creator notes, CSV/JSON import content if enabled later, and related analysis metadata.",
      },
      {
        title: "AI-Generated Outputs",
        body: "We may store generated summaries, creative analysis, recommendations, ad briefs, revenue blueprints, scores, suggested scripts, and other outputs so they can be displayed, saved, audited, supported, and improved.",
      },
      {
        title: "Payment And Billing Data",
        body: "Payments and subscription billing are expected to be handled through Shopify or third-party payment processors. BluePrintAI may receive plan, trial, subscription, renewal, cancellation, and payment-status metadata, but should not receive full payment card numbers.",
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
        body: "We may use Shopify, cloud hosting, databases, storage, logging, security, email/support, billing, AI providers, and analytics providers if enabled. Additional vendor-specific subprocessor details should be reviewed when new providers are added.",
      },
      {
        title: "Data Retention",
        body: "We retain information for as long as needed to provide the service, maintain records, comply with law, resolve disputes, secure the app, and enforce agreements. Specific retention periods should be reviewed before paid launch or broader production use.",
      },
      {
        title: "Data Deletion Requests",
        body: `To request deletion, contact ${LEGAL_PLACEHOLDERS.supportEmail} with your Shopify store domain and enough detail to identify the workspace. Destructive deletion logic should be implemented only through a safe, authenticated workflow and reviewed before launch.`,
      },
      {
        title: "User Privacy Rights",
        body: "Depending on your location, you may have rights to access, correct, delete, restrict, object to, or receive a copy of personal information. We will respond to verified requests as required by applicable law.",
      },
      {
        title: "Children And Age Restrictions",
        body: "BluePrintAI is intended for business users and is not directed to children. Do not use the app if you are under the age required to use Shopify or enter binding agreements in your jurisdiction.",
      },
      {
        title: "International Data Transfers",
        body: "Information may be processed in countries other than where you are located. International transfer mechanisms and regional disclosures should be reviewed by counsel as the app expands.",
      },
      {
        title: "Security Safeguards",
        body: "We use reasonable administrative, technical, and organizational safeguards designed to protect information. No system is completely secure, and we cannot guarantee absolute security.",
      },
      {
        title: "Breach And Contact Procedure",
        body: `If we identify a security incident requiring notice, we will follow applicable law and provider requirements. Contact ${LEGAL_PLACEHOLDERS.supportEmail} for security, privacy, or data protection questions.`,
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
        body: `For billing, cancellation, or refund questions, contact ${LEGAL_PLACEHOLDERS.supportEmail} with your Shopify store domain, plan details, and request summary.`,
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
        body: `Copyright takedown notices, counter-notices, and copyright questions should be sent to ${LEGAL_PLACEHOLDERS.supportEmail}. Include the work at issue, the location of the allegedly infringing material, your contact information, and enough detail for BluePrintAI to review the request.`,
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
        title: "Support Email",
        body: `Support requests: ${LEGAL_PLACEHOLDERS.supportEmail}. Include your Shopify store domain, the page or workflow involved, and a short description of the issue. Do not send passwords, API keys, access tokens, or unnecessary sensitive information.`,
      },
      {
        title: "Legal And Privacy Contact",
        body: `Legal, copyright, privacy, and data protection questions: ${LEGAL_PLACEHOLDERS.supportEmail}.`,
      },
      {
        title: "Business Address",
        body: LEGAL_PLACEHOLDERS.address,
      },
      {
        title: "Website",
        body: LEGAL_PLACEHOLDERS.website,
      },
      {
        title: "Legal Entity Status",
        body: `${LEGAL_PLACEHOLDERS.legalEntityStatus}. BluePrintAI is currently operated as an unregistered project/business.`,
      },
      {
        title: "Privacy And Data Deletion Requests",
        body: `For privacy or data deletion requests, contact us at ${LEGAL_PLACEHOLDERS.supportEmail}. Include your Shopify store domain and enough detail to identify the relevant workspace and records.`,
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
];
