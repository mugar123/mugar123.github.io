export interface CvEntry { title: string; subtitle?: string; period: string; where?: string; bullets?: string[]; href?: string }
export interface CvSection { id: string; label: string; entries: CvEntry[] }
export interface CvSkillGroup { label: string; items: string[] }

export const cv = {
  name: 'Nicolás Muñoz García',
  degree: 'BSc in Physics (2025–2029)',
  faculty: 'Faculty of Sciences, Universidad de Salamanca',
  location: 'Salamanca, Spain',
  contacts: [
    { label: 'Email', value: 'nicomg60@gmail.com', href: 'mailto:nicomg60@gmail.com' },
    { label: 'GitHub', value: 'github.com/mugar123', href: 'https://github.com/mugar123' },
    { label: 'Building', value: 'papertok.app', href: 'https://papertok.app' },
  ],
  sections: [
    {
      id: 'education', label: 'Education',
      entries: [
        { title: 'Universidad de Salamanca (USAL)', subtitle: 'BSc in Physics — expected June 2029', period: '2025 – present', where: 'Salamanca, Spain' },
        { title: 'Artificial neural networks: current models and deep learning', subtitle: 'Online course, BISITE Research Group · Universidad de Salamanca (September – October 2026)', period: '2026', href: 'https://bisite.usal.es/es/formacion/cursos/RNA' },
        { title: 'Upper secondary education (Bachillerato), science and technology track', subtitle: 'University entrance examination (PAU): 12.501/14 · average 9.06/10', period: '2023 – 2025' },
      ],
    },
    {
      id: 'projects', label: 'Projects',
      entries: [
        {
          title: 'PaperTok — papertok.app', subtitle: 'Founder and sole developer of a short-form discovery feed for arXiv papers', period: '2025 – present', href: 'https://papertok.app',
          bullets: [
            'Built and shipped a full web application that reformats arXiv preprints into a swipeable, TikTok-style feed, so that students and researchers discover relevant literature outside their existing reading habits; around 100 users since launch.',
            'React, Vite, Firebase (authentication, Firestore, hosting), KaTeX for in-browser mathematical notation, Transformers.js (Xenova) for client-side embeddings, and a Python proxy service for the arXiv API.',
            'Designed and iterated on the recommendation engine, which builds a semantic profile from user interactions and ranks incoming preprints against it; refactored the recommendation hook and hardened the Firebase configuration after an internal security review.',
          ],
        },
        {
          title: 'Notes → LaTeX pipeline', subtitle: 'Handwritten lecture notes transcribed into compiled LaTeX, automatically', period: '2025 – present',
          bullets: [
            'Started as self-authored, typeset course notes shared with classmates: full documents on multivariable integration and on linear transformations and determinants, with original TikZ figures illustrating diffeomorphisms as deformations of a coordinate grid.',
            'Grew into a Python pipeline that photographs a page, runs it through a mix of open-source and closed models, and emits LaTeX that compiles. Code private for now.',
            'LaTeX (MacTeX, VS Code), TikZ, custom theorem environments and page styling.',
          ],
        },
      ],
    },
    {
      id: 'activities', label: 'Extracurricular activities',
      entries: [
        { title: 'Member, Supernova', subtitle: 'Student association, Universidad de Salamanca', period: '2025 – present' },
        { title: 'Participant, astronomy outreach activities organised by Supernova', period: '2025 – 2026' },
      ],
    },
    {
      id: 'achievements', label: 'Achievements',
      entries: [
        { title: 'PAU score of 12.501/14', subtitle: 'Spanish university entrance examination', period: '2025' },
        { title: 'Participant, Spanish Physics Olympiad (Olimpiada de Física)', subtitle: 'Two consecutive editions', period: '2024, 2025' },
      ],
    },
  ] satisfies CvSection[],
  skills: [
    { label: 'Programming languages', items: ['Python', 'MATLAB (intermediate)', 'JavaScript'] },
    { label: 'Frameworks and libraries', items: ['React', 'Vite', 'Transformers.js', 'KaTeX'] },
    { label: 'Cloud and databases', items: ['Firebase (Firestore, Authentication, Hosting)'] },
    { label: 'Developer tools', items: ['Git', 'GitHub', 'VS Code', 'LaTeX (advanced)', 'TikZ', 'macOS', 'Claude Code', 'Codex', 'Cursor'] },
    { label: 'Languages', items: ['Spanish (native)', 'English (B2, certified by the Escuela Oficial de Idiomas)'] },
    { label: 'Coursework', items: ['Mathematical analysis (multivariable calculus, measure theory and Lebesgue integration, vector calculus)', 'Linear and multilinear algebra (Jordan canonical form, tensor products, bilinear and quadratic forms)', 'Electromagnetism'] },
    { label: 'Areas of interest', items: ['Computational physics', 'Machine learning applied to scientific literature', 'Recommender systems', 'Astronomy'] },
  ] satisfies CvSkillGroup[],
};
