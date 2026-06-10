export interface NavTreeNode {
  id: string;
  name: string;
  href: string;
  children: NavTreeNode[];
}

interface TreeSource {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
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
      { id: row.id, name: row.name, href: hrefFor(row.id), children: [] },
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
