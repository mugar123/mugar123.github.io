export interface Logo { name: string; src: string; url: string }

/** Data providers PaperTok reads from, each with its official mark. */
export const sources: Logo[] = [
  { name: 'arXiv', src: '/img/papertok/sources/arxiv.png', url: 'https://arxiv.org' },
  { name: 'OpenAlex', src: '/img/papertok/sources/openalex.png', url: 'https://openalex.org' },
  { name: 'PubMed', src: '/img/papertok/sources/pubmed.png', url: 'https://pubmed.ncbi.nlm.nih.gov' },
  { name: 'Europe PMC', src: '/img/papertok/sources/europepmc.png', url: 'https://europepmc.org' },
  { name: 'OpenReview', src: '/img/papertok/sources/openreview.png', url: 'https://openreview.net' },
  { name: 'NIH iCite', src: '/img/papertok/sources/nih-icite.png', url: 'https://icite.od.nih.gov' },
  { name: 'Hugging Face', src: '/img/papertok/sources/huggingface.png', url: 'https://huggingface.co' },
  { name: 'Crossref', src: '/img/papertok/sources/crossref.png', url: 'https://www.crossref.org' },
  { name: 'Semantic Scholar', src: '/img/papertok/sources/semanticscholar.png', url: 'https://www.semanticscholar.org' },
  { name: 'Unpaywall', src: '/img/papertok/sources/unpaywall.png', url: 'https://unpaywall.org' },
  { name: 'INSPIRE-HEP', src: '/img/papertok/sources/inspirehep.png', url: 'https://inspirehep.net' },
  { name: 'DataCite', src: '/img/papertok/sources/datacite.png', url: 'https://datacite.org' },
  { name: 'ORCID', src: '/img/papertok/sources/orcid.png', url: 'https://orcid.org' },
  { name: 'ROR', src: '/img/papertok/sources/ror.png', url: 'https://ror.org' },
];

/** 25 of the 398 university libraries PaperTok can open papers through (worker/institution-resolvers.ts in the PaperTok repo). */
export const universities: Logo[] = [
  { name: 'Harvard University', src: '/img/papertok/universities/harvard.png', url: 'https://harvard.edu' },
  { name: 'Massachusetts Institute of Technology', src: '/img/papertok/universities/mit.png', url: 'https://mit.edu' },
  { name: 'Princeton University', src: '/img/papertok/universities/princeton.png', url: 'https://princeton.edu' },
  { name: 'Yale University', src: '/img/papertok/universities/yale.png', url: 'https://yale.edu' },
  { name: 'Johns Hopkins University', src: '/img/papertok/universities/jhu.png', url: 'https://jhu.edu' },
  { name: 'University of California, Berkeley', src: '/img/papertok/universities/berkeley.png', url: 'https://berkeley.edu' },
  { name: 'University of California, Los Angeles', src: '/img/papertok/universities/ucla.png', url: 'https://ucla.edu' },
  { name: 'University of Michigan', src: '/img/papertok/universities/umich.png', url: 'https://umich.edu' },
  { name: 'University of Toronto', src: '/img/papertok/universities/utoronto.png', url: 'https://utoronto.ca' },
  { name: 'University of Oxford', src: '/img/papertok/universities/oxford.png', url: 'https://ox.ac.uk' },
  { name: 'University of Cambridge', src: '/img/papertok/universities/cambridge.png', url: 'https://cam.ac.uk' },
  { name: 'Imperial College London', src: '/img/papertok/universities/imperial.png', url: 'https://imperial.ac.uk' },
  { name: 'University College London', src: '/img/papertok/universities/ucl.png', url: 'https://ucl.ac.uk' },
  { name: 'ETH Zurich', src: '/img/papertok/universities/ethz.png', url: 'https://ethz.ch' },
  { name: 'École Polytechnique Fédérale de Lausanne', src: '/img/papertok/universities/epfl.png', url: 'https://epfl.ch' },
  { name: 'Technical University of Munich', src: '/img/papertok/universities/tum.png', url: 'https://tum.de' },
  { name: 'Sorbonne Université', src: '/img/papertok/universities/sorbonne.png', url: 'https://sorbonne-universite.fr' },
  { name: 'University of Amsterdam', src: '/img/papertok/universities/uva.png', url: 'https://uva.nl' },
  { name: 'University of Salamanca', src: '/img/papertok/universities/usal.png', url: 'https://usal.es' },
  { name: 'Tsinghua University', src: '/img/papertok/universities/tsinghua.png', url: 'https://tsinghua.edu.cn' },
  { name: 'University of Hong Kong', src: '/img/papertok/universities/hku.png', url: 'https://hku.hk' },
  { name: 'Seoul National University', src: '/img/papertok/universities/snu.png', url: 'https://snu.ac.kr' },
  { name: 'The University of Melbourne', src: '/img/papertok/universities/unimelb.png', url: 'https://unimelb.edu.au' },
  { name: 'Weizmann Institute of Science', src: '/img/papertok/universities/weizmann.png', url: 'https://weizmann.ac.il' },
  { name: 'University of Cape Town', src: '/img/papertok/universities/uct.png', url: 'https://uct.ac.za' },
];
