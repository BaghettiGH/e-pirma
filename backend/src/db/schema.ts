import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";

// ---------- ENUMS ----------
export const documentStatusEnum = pgEnum("document_status", [
  "draft",       // uploaded, boxes being placed
  "sent",        // sent out for signing
  "in_progress", // some signers have signed
  "completed",   // all signers signed
  "expired",
  "cancelled",
]);

export const signerStatusEnum = pgEnum("signer_status", [
  "pending",
  "viewed",
  "signed",
]);

export const signatureMethodEnum = pgEnum("signature_method", [
  "drawn",       // signed on desktop/phone canvas
  "uploaded",    // uploaded an image
  "qr_phone",    // signed via QR -> phone flow
]);

// ---------- USERS (requesters) ----------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- DOCUMENTS ----------
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  originalFileKey: text("original_file_key").notNull(),   // path/key of uploaded PDF
  signedFileKey: text("signed_file_key"),                  // path/key of final flattened signed PDF
  status: documentStatusEnum("status").default("draft").notNull(),
  totalPages: integer("total_pages"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
});

// ---------- SIGNERS (people assigned to a document) ----------
export const signers = pgTable("signers", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  accessToken: varchar("access_token", { length: 128 }).notNull().unique(), // for signer's magic link
  status: signerStatusEnum("status").default("pending").notNull(),
  order: integer("order").default(0).notNull(), // for future sequential signing
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- SIGNATURE BOXES (placed on the PDF, assigned to a signer) ----------
export const signatureBoxes = pgTable("signature_boxes", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  signerId: uuid("signer_id")
    .notNull()
    .references(() => signers.id, { onDelete: "cascade" }),
  page: integer("page").notNull(),          // 1-indexed page number
  x: doublePrecision("x").notNull(),                // position as % or px (we'll define in Phase 3)
  y: doublePrecision("y").notNull(),
  width: doublePrecision("width").notNull(),
  height: doublePrecision("height").notNull(),
  signedImageKey: text("signed_image_key"), // stored signature image once signed
  signatureMethod: signatureMethodEnum("signature_method"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- QR PHONE SIGNING SESSIONS ----------
export const phoneSignSessions = pgTable("phone_sign_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  boxId: uuid("box_id")
    .notNull()
    .references(() => signatureBoxes.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(), // encoded in QR
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- AUDIT LOG ----------
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  signerId: uuid("signer_id").references(() => signers.id, {
    onDelete: "set null",
  }),
  action: varchar("action", { length: 100 }).notNull(), // e.g. "uploaded", "sent", "viewed", "signed", "completed"
  metadata: jsonb("metadata"), // ip, user agent, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});