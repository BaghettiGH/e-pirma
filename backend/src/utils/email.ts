import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export async function sendSignRequestEmail(params: {
  to: string;
  signerName: string;
  documentTitle: string;
  requesterName: string;
  accessToken: string;
}) {
  const signUrl = `${FRONTEND_URL}/sign/${params.accessToken}`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `${params.requesterName} sent you a document to sign: ${params.documentTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been asked to sign a document</h2>
        <p>Hi ${params.signerName},</p>
        <p><strong>${params.requesterName}</strong> has sent you <strong>${params.documentTitle}</strong> for signature.</p>
        <a href="${signUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin-top:12px;">
          Review & Sign Document
        </a>
        <p style="color:#666; font-size:13px; margin-top:24px;">
          If the button doesn't work, copy this link: ${signUrl}
        </p>
      </div>
    `,
  });
}

export async function sendCompletionEmail(params: {
  to: string;
  documentTitle: string;
  documentId: string;
}) {
  const dashboardUrl = `${FRONTEND_URL}/documents/${params.documentId}`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `All signers have signed: ${params.documentTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Your document is fully signed 🎉</h2>
        <p><strong>${params.documentTitle}</strong> has been signed by all recipients.</p>
        <a href="${dashboardUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin-top:12px;">
          View & Download Signed Document
        </a>
      </div>
    `,
  });
}

export async function sendSignerCompletedNotification(params: {
  to: string;
  documentTitle: string;
  signerName: string;
  documentId: string;
}) {
  const dashboardUrl = `${FRONTEND_URL}/documents/${params.documentId}`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `${params.signerName} signed: ${params.documentTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p><strong>${params.signerName}</strong> just signed <strong>${params.documentTitle}</strong>.</p>
        <a href="${dashboardUrl}" style="color:#111;">View status</a>
      </div>
    `,
  });
}