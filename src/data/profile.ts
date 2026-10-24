/**
 * Everything personal on the site comes from this file.
 * Edit `availability` whenever your situation changes; it appears in the header, hero, contact and CV.
 */
export const profile = {
  name: 'Muttakin Rahman',
  fullName: 'Muttakin Rahman Shoscho',
  email: 'muttakinrahmanshoscho@gmail.com',
  github: 'https://github.com/shadowfax-505',
  linkedin: 'https://www.linkedin.com/in/muttakin-rahman/',
  location: 'Khulna, Bangladesh',
  university: 'Khulna University of Engineering & Technology',
  universityShort: 'KUET',
  degree: 'B.Sc. in Computer Science & Engineering',
  availability: 'Open to internships, research-assistant roles and freelance projects',
  headline: 'I design data-acquisition hardware, write the firmware and tools around it, and build full-stack web applications.',
};

export const services = [
  {
    title: 'Embedded data acquisition',
    text: 'Schematic and PCB in KiCad, ESP32 firmware, datasheet-level design review and simulation before anything is soldered.',
    items: ['KiCad schematic + layout, DRC/ERC clean', 'ESP32-S3 / ESP-IDF firmware', 'ADC and IMU drivers, SD logging', 'Wokwi and ngspice simulation'],
    proof: { label: 'AFO research recorder', href: '/work/afo-recorder/' },
  },
  {
    title: 'Full-stack web applications',
    text: 'Database-backed apps with real roles, workflows and tests, from schema to deployment scaffolding.',
    items: ['Laravel, Express, Next.js', 'Oracle, MySQL, SQLite', 'Role-based access, audit trails', 'Feature, unit and browser tests'],
    proof: { label: 'CivicLens', href: '/work/civiclens/' },
  },
  {
    title: 'Local AI features',
    text: 'AI features that run on your own hardware, check every answer against your data, and come with measured reliability.',
    items: ['Ollama and OpenAI-compatible servers', 'JSON-schema output, validation, retry', 'Rule-based fallback the user can see', 'Evaluation: usable rate, latency, accuracy'],
    proof: { label: 'ZenFlow', href: '/work/zenflow/' },
  },
  {
    title: 'Research software',
    text: 'Reproducible experiments: data pipelines, evaluation harnesses and write-ups that say what was and was not measured.',
    items: ['Python data pipelines', 'Evaluation on held-out data', 'Model and toolchain benchmarking', 'LaTeX manuscripts'],
    proof: { label: 'Research', href: '/research/' },
  },
];

export const skills = [
  { group: 'Hardware', items: ['KiCad', 'ESP32-S3 / ESP-IDF', 'AD7606, ADS131M04', 'ICM-42688-P, MPU-6050', 'ngspice', 'Wokwi'] },
  { group: 'Languages', items: ['C', 'Python', 'TypeScript', 'PHP', 'Java', 'SQL'] },
  { group: 'Web', items: ['Laravel', 'Express', 'Next.js', 'Astro', 'ASP.NET Core MVC', 'Three.js'] },
  { group: 'Data', items: ['Oracle', 'MySQL', 'SQLite / Room', 'pandas', 'PyTorch'] },
  { group: 'AI', items: ['Ollama, local LLMs', 'Structured output + validation', 'LLM evaluation harnesses'] },
];

export const achievements = [
  { title: 'National Physics Olympiad', detail: 'Fourth place nationally, Category C', date: '2022', url: undefined },
  { title: 'Regional Physics Olympiad', detail: 'Second place, regional round', date: '', url: undefined },
  { title: 'Jashore Board Talent Scholarship', detail: 'Higher Secondary Certificate, Science', date: 'HSC 2022', url: 'https://www.jessoreboard.gov.bd/uploads/notice/07_20230316182503_799.pdf' },
  { title: 'Astronomy & Astrophysics Olympiad', detail: 'National-round qualifier from the Khulna regional round', date: 'Apr 2022', url: undefined },
];

export const community = [
  { title: 'Hardware Acceleration Club of KUET (HACK)', role: 'Senior Executive', since: 'Since Nov 2025' },
  { title: 'Embedded Innovators', role: 'Member', since: 'Since Mar 2025' },
  { title: 'SGIPC, KUET programming community', role: 'Member', since: 'Since Mar 2024' },
];

/** Smaller work, one line each. */
export const elsewhere = [
  { title: 'HACK club website', text: 'ASP.NET Core MVC site for the Hardware Acceleration Club of KUET: projects with comments and moderation, events with registration, team pages.', url: 'https://github.com/shadowfax-505/KUET-Hardware-Acceleration-Club' },
  { title: 'BanglaCode compiler', text: 'Compiler-lab project in Python for a small C-like language with Bangla keywords: lexer, LALR parser, semantic analysis, three-address IR, an interpreter and a C back end; 90 tests.', url: undefined },
];

/** Independent coverage of my work. */
export const press = [
  {
    outlet: 'Dainik Shiksha',
    date: '2019-04-01',
    title: 'ড্রোন বানালো ঝিনাইদহের একদল শিক্ষার্থী',
    translation: 'A group of students from Jhenaidah built a drone',
    url: 'https://www.dainikshiksha.com/%E0%A6%A1%E0%A7%8D%E0%A6%B0%E0%A7%8B%E0%A6%A8-%E0%A6%AC%E0%A6%BE%E0%A6%A8%E0%A6%BE%E0%A6%B2%E0%A7%8B-%E0%A6%9D%E0%A6%BF%E0%A6%A8%E0%A6%BE%E0%A6%87%E0%A6%A6%E0%A6%B9%E0%A7%87%E0%A6%B0-%E0%A6%8F%E0%A6%95%E0%A6%A6%E0%A6%B2-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A5%E0%A7%80/159425/',
    note: 'The article lists me as মুস্তাকিম রহমান স্বচ্ছ.',
    work: '/work/drone/',
  },
];
