export function removeUnexpectedDocumentChildren(documentObject) {
  if (!documentObject?.documentElement) return [];

  const removed = [];

  for (const child of Array.from(documentObject.documentElement.children)) {
    if (child === documentObject.head || child === documentObject.body) continue;

    removed.push(child);
    child.remove();
  }

  return removed;
}
