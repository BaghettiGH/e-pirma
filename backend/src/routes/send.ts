import { Elysia } from "elysia";
import { db } from "../db/client";
import { documents, signers, auditLogs, users } from "../db/schema";
import { authGuard } from "../middleware/authGuard";
import { eq } from "drizzle-orm";
import { sendSignRequestEmail } from "../utils/email";

export const sendRoutes = new Elysia({ prefix: "/documents" })
  .use(authGuard)
  .post("/:id/send", async ({ params, user, set }) => {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, params.id),
    });

    if (!doc || doc.requesterId !== user.userId) {
      set.status = 404;
      return { error: "Document not found" };
    }

    if (doc.status !== "draft") {
      set.status = 400;
      return { error: "Document has already been sent" };
    }

    const docSigners = await db.query.signers.findMany({
      where: eq(signers.documentId, doc.id),
    });

    if (docSigners.length === 0) {
      set.status = 400;
      return { error: "No signers assigned to this document" };
    }

    const requester = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
    });

    // Send email to each signer
    for (const signer of docSigners) {
      await sendSignRequestEmail({
        to: signer.email,
        signerName: signer.name,
        documentTitle: doc.title,
        requesterName: requester?.name || "Someone",
        accessToken: signer.accessToken,
      });
    }

    await db
      .update(documents)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(documents.id, doc.id));

    await db.insert(auditLogs).values({
      documentId: doc.id,
      action: "sent",
      metadata: { signerCount: docSigners.length },
    });

    return { success: true, sentTo: docSigners.map((s) => s.email) };
  })
  .get("/:id/status", async ({ params, user, set }) => {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, params.id),
    });

    if (!doc || doc.requesterId !== user.userId) {
      set.status = 404;
      return { error: "Document not found" };
    }

    const docSigners = await db.query.signers.findMany({
      where: eq(signers.documentId, doc.id),
    });

    return {
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        sentAt: doc.sentAt,
        completedAt: doc.completedAt,
      },
      signers: docSigners.map((s) => ({
        name: s.name,
        email: s.email,
        status: s.status,
        viewedAt: s.viewedAt,
        signedAt: s.signedAt,
      })),
    };
  });