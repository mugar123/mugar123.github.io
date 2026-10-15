export interface PostLike {
  id: string;
  data: { date: Date; draft: boolean };
}

export function publishedPosts<T extends PostLike>(entries: T[], now: Date = new Date()): T[] {
  return entries
    .filter((e) => !e.data.draft && e.data.date.getTime() <= now.getTime())
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
