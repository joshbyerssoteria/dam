export interface NavTreeNode {
  id: string;
  name: string;
  href: string;
  /** folders can receive drops; leaves (kits) can be dragged */
  kind: "folder" | "leaf";
  /** Marks a special static container (e.g. the Sermon Series kit folder). */
  variant?: "sermon_series";
  children: NavTreeNode[];
}

interface TreeSource {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  /** Optional folder kind; "sermon_series" gets a distinguishing icon. */
  kind?: string | null;
}

/** Build a nested nav tree from flat parent_id rows. */
export function buildNavTree(
  rows: TreeSource[],
  hrefFor: (id: string) => string,
  leaves?: Array<{ id: string; name: string; parentId: string | null; href: string }>
): NavTreeNode[] {
  const nodeById = new Map<string, NavTreeNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        href: hrefFor(row.id),
        kind: "folder" as const,
        ...(row.kind === "sermon_series"
          ? { variant: "sermon_series" as const }
          : {}),
        children: [],
      },
    ])
  );

  const roots: NavTreeNode[] = [];
  const sorted = [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
  for (const row of sorted) {
    const node = nodeById.get(row.id)!;
    const parent = row.parent_id ? nodeById.get(row.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Leaves (e.g. kits) attach under their folder, or at the root.
  for (const leaf of leaves ?? []) {
    const node: NavTreeNode = {
      id: leaf.id,
      name: leaf.name,
      href: leaf.href,
      kind: "leaf",
      children: [],
    };
    const parent = leaf.parentId ? nodeById.get(leaf.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
