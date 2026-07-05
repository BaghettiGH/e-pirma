import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const BUCKET = process.env.SUPABASE_BUCKET || "documents";

export async function uploadFile(path: string, file: Buffer, contentType: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data.path;
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Failed to get signed URL: ${error.message}`);
  return data.signedUrl;
}