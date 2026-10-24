// Aspirational achievements. These are deliberately separate from earned recognition.
export const milestones = [
  {
    id: 'dialect-study', number: '01', area: 'Language technology', status: 'Target',
    title: 'Publish the dialect-erasure study.',
    first: 'Validate the dialect and standard test items with native speakers, then repeat the measurements on real printed pages.',
    proof: 'A public paper or preprint with its test sets, prompts and code, so anyone can rerun the measurements.',
    link: '/research/#dialect-erasure', linkLabel: 'Read the research question',
  },
  {
    id: 'inventory-study', number: '02', area: 'Research practice', status: 'Target',
    title: 'Publish an experiment others can rerun.',
    first: 'Have the inventory proofs checked independently and agree a small field pilot with a retailer.',
    proof: 'A public study with a pinned environment, the public datasets it uses, raw results and the code behind every table.',
    link: '/research/#inventory-censoring', linkLabel: 'See the inventory study',
  },
  {
    id: 'language-release', number: '03', area: 'Compilers', status: 'Target',
    title: 'Ship a language from source to IR.',
    first: 'BanglaCode already goes from source to three-address IR and C, with 90 tests. Release it publicly once the look-alike identifier disclosure is complete.',
    proof: 'A versioned public release with a grammar, diagnostics, intermediate representation, tests and a documented optimization.',
    link: '/research/#compiler-study', linkLabel: 'Try the compiler specimen',
  },
  {
    id: 'bench-validation', number: '04', area: 'Embedded systems', status: 'Target',
    title: 'Take the recorder onto the bench.',
    first: 'Assemble one AD7606 board and run the written bench stages, starting with power-up and the supply-ramp fix.',
    proof: 'Dated setup photographs, raw traces, measured timing and loss, and a report describing the test conditions and limits.',
    link: '/work/afo-recorder/', linkLabel: 'See the recorder design',
  },
  {
    id: 'upstream-contribution', number: '05', area: 'Open source', status: 'Target',
    title: 'Land a useful upstream contribution.',
    first: 'Choose a maintained project I use, reproduce an issue, and discuss a focused fix with its maintainers.',
    proof: 'A merged upstream pull request with a clear contribution, relevant validation, and a short account of what I learned.',
    link: 'https://github.com/shadowfax-505', linkLabel: 'Follow my GitHub work',
  },
  {
    id: 'systems-workshop', number: '06', area: 'Community', status: 'Target',
    title: 'Teach a hands-on systems workshop.',
    first: 'Prepare one small build, a tested setup guide, and exercises someone else can complete.',
    proof: 'Published workshop material, a dated session record, example solutions, and participant feedback shared with permission.',
    link: '/#about', linkLabel: 'Meet my learning communities',
  },
] as const;
