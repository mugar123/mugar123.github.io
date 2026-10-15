import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { publishedPosts } from '@/lib/posts';

export async function GET(context: APIContext) {
  const posts = publishedPosts(await getCollection('writing'));
  return rss({
    title: 'Nicolás Muñoz — Logbook',
    description: 'Notes on building things while studying physics.',
    site: context.site!,
    items: posts.map((p) => ({ title: p.data.title, pubDate: p.data.date, description: p.data.summary, link: `/writing/${p.id}/` })),
  });
}
