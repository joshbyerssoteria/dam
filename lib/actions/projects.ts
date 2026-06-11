"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable(),
});

export async function createProject(input: {
  name: string;
  parentId: string | null;
}): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid project name" };

  const db = await createClient();
  const { data: space } = await db.from("spaces").select("id").limit(1).single();
  if (!space) return { ok: false, error: "No space configured" };

  const { data: project, error } = await db
    .from("projects")
    .insert({
      space_id: space.id,
      parent_id: parsed.data.parentId,
      name: parsed.data.name,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !project) return { ok: false, error: "Failed to create project" };

  revalidatePath("/photos/projects");
  return { ok: true, projectId: project.id };
}

export async function renameProject(
  projectId: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required" };

  const db = await createClient();
  const { error } = await db
    .from("projects")
    .update({ name: trimmed })
    .eq("id", projectId);
  if (error) return { ok: false, error: "Failed to rename" };

  revalidatePath("/photos/projects");
  return { ok: true };
}

/**
 * Move a project under a new parent (or to the root with null). Guards
 * against moving a project into itself or one of its own descendants.
 */
export async function moveProject(
  projectId: string,
  newParentId: string | null
): Promise<{ ok: boolean; error?: string; unchanged?: boolean }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }
  if (projectId === newParentId) {
    return { ok: false, error: "A project can't contain itself" };
  }

  const db = await createClient();

  // No-op if dropped back onto its current parent — nothing moved.
  const { data: current } = await db
    .from("projects")
    .select("parent_id")
    .eq("id", projectId)
    .single();
  if (current && current.parent_id === newParentId) {
    return { ok: true, unchanged: true };
  }

  if (newParentId) {
    // Walk up from the target; if we reach projectId, the move is a cycle.
    const { data: allProjects } = await db
      .from("projects")
      .select("id, parent_id");
    const parentOf = new Map(
      (allProjects ?? []).map((p) => [p.id, p.parent_id])
    );
    let cursor: string | null = newParentId;
    for (let depth = 0; cursor && depth < 100; depth += 1) {
      if (cursor === projectId) {
        return { ok: false, error: "Can't move a project into its own subproject" };
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const { error } = await db
    .from("projects")
    .update({ parent_id: newParentId })
    .eq("id", projectId);
  if (error) return { ok: false, error: "Failed to move project" };

  revalidatePath("/photos/projects");
  return { ok: true };
}

/**
 * Delete a project (and its subprojects). Only the project rows and their
 * photo LINKS are removed — the photos themselves are never touched, so
 * editors may delete projects too.
 */
export async function deleteProject(
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const db = await createClient();
  const { error } = await db.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: "Failed to delete project" };

  revalidatePath("/photos/projects");
  return { ok: true };
}

const linkSchema = z.object({
  projectId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1).max(500),
});

/** Link photos to a project. Photos stay where they are — no copy, no move. */
export async function addPhotosToProject(
  projectId: string,
  photoIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = linkSchema.safeParse({ projectId, photoIds });
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const db = await createClient();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", parsed.data.projectId)
    .single();
  if (!project) return { ok: false, error: "Project not found" };

  const { error } = await db.from("project_photos").upsert(
    parsed.data.photoIds.map((photoId) => ({
      project_id: parsed.data.projectId,
      photo_id: photoId,
      added_by: session.userId,
    })),
    { onConflict: "project_id,photo_id", ignoreDuplicates: true }
  );
  if (error) return { ok: false, error: "Failed to add to project" };

  revalidatePath("/photos/projects");
  return { ok: true };
}

/** Unlink photos from a project. The photos themselves are untouched. */
export async function removePhotosFromProject(
  projectId: string,
  photoIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = linkSchema.safeParse({ projectId, photoIds });
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const db = await createClient();
  const { error } = await db
    .from("project_photos")
    .delete()
    .eq("project_id", parsed.data.projectId)
    .in("photo_id", parsed.data.photoIds);
  if (error) return { ok: false, error: "Failed to remove from project" };

  revalidatePath("/photos/projects");
  return { ok: true };
}
