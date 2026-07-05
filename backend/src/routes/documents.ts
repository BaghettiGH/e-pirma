import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { documents, auditLogs } from "../db/schema";
import { authGuard } from "../middleware/authGuard";
import { uploadFile, getSignedUrl } from "../utils/supabase";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

export const documentRoutes = new Elysia({ prefix: "/documents" })
  .use(authGuard)
  .post(
    "/upload",
    async ({ body, user, set }) => {
      const file = body.file;

      if (file.type !== "application/pdf") {
        set.status = 400;
        return { error: "Only PDF files are accepted" };
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileKey = `${user.userId}/${nanoid()}-${file.name}`;
      await uploadFile(fileKey, buffer, "application/pdf");

      const [doc] = await db
        .insert(documents)
        .values({
          requesterId: user.userId,
          title: body.title || file.name,
          originalFileKey: fileKey,
          status: "draft",
        })
        .returning();

      await db.insert(auditLogs).values({
        documentId: doc.id,
        action: "uploaded",
        metadata: { fileName: file.name, size: buffer.length },
      });

      return { document: doc };
    },
    {
      body: t.Object({
        file: t.File(),
        title: t.Optional(t.String()),
      }),
    }
  )
  .get("/", async ({ user }) => {
    const docs = await db.query.documents.findMany({
      where: eq(documents.requesterId, user.userId),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });
    return { documents: docs };
  })
  .get("/:id", async ({ params, user, set }) => {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, params.id),
    });

    if (!doc || doc.requesterId !== user.userId) {
      set.status = 404;
      return { error: "Document not found" };
    }

    const fileUrl = await getSignedUrl(doc.originalFileKey);

    return { document: doc, fileUrl };
  });