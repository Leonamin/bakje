"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/** Hides or restores a post, then drops every cached page so lists we navigate back to are refetched. */
export async function setSourceHidden(id: number, hidden: boolean): Promise<void> {
  db()
    .prepare("UPDATE source SET hidden_at = ? WHERE id = ?")
    .run(hidden ? new Date().toISOString() : null, id);
  revalidatePath("/", "layout");
}
