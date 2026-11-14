import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'work'>;
export const workHref = (id: string) => `/pages/portfolio/${id}`;

/** Every portfolio item: products first, then personal builds newest first (by `order`). */
export async function allWork(): Promise<Work[]> {
  return (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
}
