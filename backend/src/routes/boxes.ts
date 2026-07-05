import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { documents, signers, signatureBoxes, auditLogs } from "../db/schema";
import { authGuard } from "../middleware/authGuard";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const boxRoutes = new Elysia({ prefix: "/documents" })
  .use(authGuard)
  .post(
    "/:id/boxes",
    async ({ params, body, user, set }) => {
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, params.id),
      });

      if (!doc || doc.requesterId !== user.userId) {
        set.status = 404;
        return { error: "Document not found" };
      }

      if (doc.status !== "draft") {
        set.status = 400;
        return { error: "Cannot edit boxes after document has been sent" };
      }

      // Clear existing signers/boxes for this doc (allows re-saving edits)
      await db.delete(signatureBoxes).where(eq(signatureBoxes.documentId, doc.id));
      await db.delete(signers).where(eq(signers.documentId, doc.id));

      // Group incoming boxes by signer email so we create one signer per unique person
      const signerMap = new Map<string, string>(); // email -> signerId

      for (const person of body.signers) {
        const [signer] = await db
          .insert(signers)
          .values({
            documentId: doc.id,
            name: person.name,
            email: person.email,
            accessToken: nanoid(32),
          })
          .returning();
        signerMap.set(person.email, signer.id);
      }

      const insertedBoxes = [];
      for (const box of body.boxes) {
        const signerId = signerMap.get(box.signerEmail);
        if (!signerId) continue; // skip if malformed

        const [inserted] = await db
          .insert(signatureBoxes)
          .values({
            documentId: doc.id,
            signerId,
            page: box.page,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          })
          .returning();
        insertedBoxes.push(inserted);
      }

      await db.insert(auditLogs).values({
        documentId: doc.id,
        action: "boxes_placed",
        metadata: { boxCount: insertedBoxes.length, signerCount: signerMap.size },
      });

      return { boxes: insertedBoxes, signerCount: signerMap.size };
    },
    {
      body: t.Object({
        signers: t.Array(
          t.Object({
            name: t.String({ minLength: 1 }),
            email: t.String({ format: "email" }),
          })
        ),
        boxes: t.Array(
          t.Object({
            signerEmail: t.String({ format: "email" }),
            page: t.Number(),
            x: t.Number(), // percentage 0-100 of page width
            y: t.Number(), // percentage 0-100 of page height
            width: t.Number(), // percentage
            height: t.Number(), // percentage
          })
        ),
      }),
    }
  )
  .get("/:id/boxes", async ({ params, user, set }) => {
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
    const boxes = await db.query.signatureBoxes.findMany({
      where: eq(signatureBoxes.documentId, doc.id),
    });

    return { signers: docSigners, boxes };
  });