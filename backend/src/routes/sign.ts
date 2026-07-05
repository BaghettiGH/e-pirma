import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { documents, signers, signatureBoxes, auditLogs } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getSignedUrl, uploadFile } from "../utils/supabase";
import { sendSignerCompletedNotification, sendCompletionEmail } from "../utils/email";

export const signRoutes = new Elysia({ prefix: "/sign" })
  // Fetch document + boxes for this signer via their access token
  .get("/:token", async ({ params, set }) => {
    const signer = await db.query.signers.findFirst({
      where: eq(signers.accessToken, params.token),
    });

    if (!signer) {
      set.status = 404;
      return { error: "Invalid or expired signing link" };
    }

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, signer.documentId),
    });

    if (!doc) {
      set.status = 404;
      return { error: "Document not found" };
    }

    // Mark as viewed (first time only)
    if (signer.status === "pending") {
      await db
        .update(signers)
        .set({ status: "viewed", viewedAt: new Date() })
        .where(eq(signers.id, signer.id));

      await db.insert(auditLogs).values({
        documentId: doc.id,
        signerId: signer.id,
        action: "viewed",
      });
    }

    const fileUrl = await getSignedUrl(doc.originalFileKey);

    // Only return boxes belonging to THIS signer for actions,
    // but return all boxes so UI can show "waiting on others" state
    const allBoxes = await db.query.signatureBoxes.findMany({
      where: eq(signatureBoxes.documentId, doc.id),
    });

    const allSigners = await db.query.signers.findMany({
      where: eq(signers.documentId, doc.id),
    });

    return {
      document: { id: doc.id, title: doc.title, status: doc.status },
      signer: { id: signer.id, name: signer.name, email: signer.email, status: signer.status },
      fileUrl,
      boxes: allBoxes.map((b) => ({
        id: b.id,
        signerId: b.signerId,
        page: b.page,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        signedAt: b.signedAt,
        isMine: b.signerId === signer.id,
      })),
      signers: allSigners.map((s) => ({
        name: s.name,
        status: s.status,
      })),
    };
  })
  // Submit a signature for one of the signer's boxes
  .post(
    "/:token/boxes/:boxId",
    async ({ params, body, set }) => {
      const signer = await db.query.signers.findFirst({
        where: eq(signers.accessToken, params.token),
      });

      if (!signer) {
        set.status = 404;
        return { error: "Invalid or expired signing link" };
      }

      const box = await db.query.signatureBoxes.findFirst({
        where: and(
          eq(signatureBoxes.id, params.boxId),
          eq(signatureBoxes.signerId, signer.id)
        ),
      });

      if (!box) {
        set.status = 404;
        return { error: "Box not found or not assigned to you" };
      }

      // body.imageBase64 is a data URL from canvas or uploaded file, converted client-side
      const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const imageKey = `signatures/${signer.documentId}/${box.id}.png`;
      await uploadFile(imageKey, buffer, "image/png");

      await db
        .update(signatureBoxes)
        .set({
          signedImageKey: imageKey,
          signatureMethod: body.method,
          signedAt: new Date(),
        })
        .where(eq(signatureBoxes.id, box.id));

      return { success: true };
    },
    {
      body: t.Object({
        imageBase64: t.String(),
        method: t.Union([t.Literal("drawn"), t.Literal("uploaded"), t.Literal("qr_phone")]),
      }),
    }
  )
  // Finalize: signer confirms all their boxes are done
  .post("/:token/complete", async ({ params, set }) => {
    const signer = await db.query.signers.findFirst({
      where: eq(signers.accessToken, params.token),
    });

    if (!signer) {
      set.status = 404;
      return { error: "Invalid or expired signing link" };
    }

    const myBoxes = await db.query.signatureBoxes.findMany({
      where: eq(signatureBoxes.signerId, signer.id),
    });

    const allSigned = myBoxes.every((b) => b.signedAt !== null);
    if (!allSigned) {
      set.status = 400;
      return { error: "Please sign all your boxes before completing" };
    }

    await db
      .update(signers)
      .set({ status: "signed", signedAt: new Date() })
      .where(eq(signers.id, signer.id));

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, signer.documentId),
    });

    await db.insert(auditLogs).values({
      documentId: signer.documentId,
      signerId: signer.id,
      action: "signed",
    });

    // Check if ALL signers on the doc are done
    const allSigners = await db.query.signers.findMany({
      where: eq(signers.documentId, signer.documentId),
    });
    const everyoneSigned = allSigners.every((s) => s.status === "signed");

    const requester = doc
      ? await db.query.users.findFirst({ where: eq(documents.requesterId, doc.requesterId) })
      : null;

    if (everyoneSigned && doc) {
      await db
        .update(documents)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(documents.id, doc.id));

      await db.insert(auditLogs).values({
        documentId: doc.id,
        action: "completed",
      });

      // Notify requester — full completion email (Phase 6 will attach the flattened PDF/download link)
      const req = await db.query.users.findFirst({
        where: eq(documents.requesterId, doc.requesterId) as any,
      });
      // (see note below about the fetch pattern)
    } else if (doc) {
      await db
        .update(documents)
        .set({ status: "in_progress" })
        .where(eq(documents.id, doc.id));
    }

    return { success: true, allComplete: everyoneSigned };
  });