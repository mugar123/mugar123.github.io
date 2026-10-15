import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { workSchema, writingSchema } from './content/schemas';

const work = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/work' }), schema: workSchema });
const writing = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/writing' }), schema: writingSchema });

export const collections = { work, writing };
