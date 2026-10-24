import { achievements, community, profile } from './profile';

export type NotebookPage = {
  id: string; title: string; kicker: string; text: string; art: string;
  nodes: string[]; caption: string; figure?: string; image?: string;
};
export type NotebookDefinition = { id: string; title: string; accent: 'red' | 'cobalt'; pages: NotebookPage[] };
const page = (id: string, title: string, text: string, art: string, nodes: string[], caption = 'Original explanatory illustration.', figure?: string): NotebookPage => ({ id, title, kicker: id.replaceAll('-', ' / ').toUpperCase(), text, art, nodes, caption, figure });
const book = (id: string, title: string, pages: NotebookPage[], accent: 'red' | 'cobalt' = 'red'): NotebookDefinition => ({ id, title, pages, accent });

/** Keyed by a project's `visual`. Every leaf restates something the case study or its repository shows. */
export const projectNotebooks: Record<string, NotebookDefinition> = {
  civic: book('work-civiclens', 'CivicLens', [
    page('connected-records', 'Public records, connected.', 'Projects, budgets, procurement, contractors and documents live in one schema, so an inconsistency shows up when records are put side by side.', 'cover', ['Projects', 'Budgets', 'Contracts', 'Evidence']),
    page('evidence-workflow', 'Follow the evidence.', 'Deterministic integrity rules flag patterns such as repeated tender revisions or out-of-line contract values. Each finding carries the evidence that triggered it, and a rule can be dry-run before it goes live.', 'workflow', ['Records', 'Integrity rule', 'Finding + evidence', 'Human review']),
    page('governed-access', 'Who can do what?', 'Role- and permission-based access with an activity log, and authorization tested as behaviour. A finding is a reason for a person to look, never a verdict.', 'access', ['Identity', 'Role', 'Permission', 'Audit log']),
    page('release-record', 'Implemented. Still accountable.', 'Tagged v1.0.0 and validated on a local Docker production stack. 103 Pest test files, 8 Playwright specs and PHPStan level 8 on the app layer.', 'ledger', ['v1.0.0 tagged', 'Local Docker stack', '103 Pest + 8 Playwright', 'PHPStan level 8'], 'From the repository and its v1.0.0 release notes.', 'v1.0.0'),
  ]),
  researchhub: book('work-researchhub', 'ResearchHub', [
    page('reading-room', 'A reading room for research.', 'Discover papers, keep collections and follow ideas. This is a capture of the app running locally against Oracle with seeded records.', 'cover', ['Discover', 'Collect', 'Connect', 'Discuss'], 'Real local capture; seeded development records.'),
    page('library-workflow', 'From discovery to a library.', 'Search, read, save to a collection, export. The browser journeys check that saved papers survive a reload and that an uploaded PDF comes back byte for byte.', 'library', ['Search', 'Read', 'Save', 'Export']),
    page('oracle-architecture', 'Relationships are the product.', 'Next.js talks to an Express API and Oracle. Ownership and permissions are checked against the database on every request; related writes run inside transactions.', 'stack', ['Next.js / React', 'Express / JWT', 'Oracle / PL/SQL', 'Transactions + permissions']),
    page('verified-boundary', 'Tested workflows. Clear limits.', '65 Oracle integration checks, 27 API unit checks and 8 browser journeys pass locally. A public deployment still needs hosted Oracle and email delivery.', 'ledger', ['65 Oracle checks', '27 API unit checks', '8 browser journeys', 'Next: hosted demo'], 'Local verification record.', '65 / 27 / 8'),
  ], 'cobalt'),
  zenflow: book('work-zenflow', 'ZenFlow', [
    page('focus-cycle', 'One thing at a time.', 'A focus timer and screen-time tracker for desktop and Android, with an assistant that runs on a local model.', 'cover', ['Focus', 'Plan', 'Reflect']),
    page('two-platforms', 'Desktop and Android.', 'JavaFX and SQLite on the desktop, Room and Material 3 on Android. Both keep data on the device, hash passwords with PBKDF2 and migrate old data in place.', 'platforms', ['JavaFX 25 + SQLite', 'Android + Room', 'Local data', 'PBKDF2 accounts']),
    page('local-assistant', 'An assistant that checks itself.', 'Seven AI features run on qwen3:1.7b through Ollama. Answers follow a JSON schema and are checked against your data; a failed answer gets one retry, then rules take over and the card says so.', 'workflow', ['Your data', 'Local model', 'Checks + repairs', 'Retry or rules']),
    page('measured', 'Measured, not assumed.', '69 of 70 answers usable on the first try across seven tasks, ten runs each, on an M1 MacBook Air. Moving date arithmetic into code took exact capture dates from 20% to 80%.', 'ledger', ['69 / 70 first try', '0 / 70 fell back', '20% → 80% dates', '58 + 8 unit tests'], 'From docs/ai-eval.md in the desktop repository.', '69 / 70'),
  ]),
  afo: book('work-afo-recorder', 'AFO research recorder', [
    page('acquisition-design', 'Listen to the signal.', 'Two EMG channels at 8 kHz and two motion sensors at 200 Hz, written to microSD as numbered, timestamped, CRC-checked records.', 'cover', ['Sense', 'Synchronize', 'Record', 'Recover'], 'Signal illustration; bench validation pending.'),
    page('shared-clock', 'One clock for everything.', 'An AD7606 samples EMG on a hardware trigger and two ICM-42688-P IMUs stream motion. The ESP32-S3 timestamps both and queues 2.44 s of data in PSRAM, so an SD stall loses nothing.', 'workflow', ['2 × EMG at 8 kHz', '2 × IMU at 200 Hz', 'ESP32-S3 timestamps', 'microSD first']),
    page('recording-integrity', 'Simulated before soldered.', 'Firmware 1.12 passes 18 of 18 Wokwi fault scenarios, from a stuck BUSY line to a 350 ms SD stall. The same matrix caught a live-preview race in 1.11.', 'recovery', ['Custom Wokwi chips', '18 fault scenarios', 'Race found in 1.11', 'Fixed in 1.12'], 'Simulation results, not bench measurements.'),
    page('validation-boundary', 'The bench is the next chapter.', 'Six board variants, DRC and ERC clean, with a supply-ramp fix from ADI AN-1091. No physical board has been measured yet; the bench stages have written pass criteria.', 'checklist', ['6 board variants', 'DRC / ERC: 0 / 0', 'Bench: pending', 'Pass criteria written'], 'Physical validation pending. No clinical claim.', 'next.'),
  ], 'cobalt'),
  gas: book('work-gas-safety', 'IoT gas safety system', [
    page('detection-loop', 'A system that responds.', 'A school ESP32 prototype: detect gas, sound an alarm, switch on a fan and alert someone over the web.', 'cover', ['Detect', 'ESP32', 'Alarm + fan', 'Web signal'], 'Diagram drawn for this site from memory of the build.'),
    page('automatic-response', 'Sense. Decide. Act.', 'My first complete loop: a physical reading, a decision and an action, with nobody pressing a button.', 'response', ['Gas detection', 'ESP32', 'Alarm', 'Fan']),
    page('web-signal', 'Beyond the room.', 'The same board sent an alert over the web, so someone outside the room would know.', 'web', ['Local detection', 'Automatic outputs', 'Web alert', 'Someone outside']),
  ]),
  drone: book('work-drone', 'GPS quadcopter', [
    page('flight-study', 'The urge to build.', 'A GPS quadcopter built over a year and a half by a five-student team at Jhenaidah Government Boys’ High School.', 'cover', ['Frame', 'Flight controller', 'GPS'], '3D reconstruction of an F450-class quad; original photos lost.'),
    page('component-study', 'An F450-class frame.', 'Frame, motors, flight controller, programming and GPS. The drawing shows the class of machine we built, not the original parts list.', 'drone-parts', ['F450-class frame', 'Brushless motors', 'Flight controller', 'GPS mast'], 'Illustration of the frame class.'),
    page('remembered-build', 'Flown in public.', 'Shown at the 40th National Science and Technology Week in Jhenaidah in 2019, where the Deputy Commissioner flew it. Dainik Shiksha reported it on 1 April 2019.', 'archive', ['Team of five', 'A year and a half', 'Flown by the DC', 'Dainik Shiksha, 2019'], 'Source: Dainik Shiksha, 1 April 2019.', '2019'),
  ], 'cobalt'),
};

/** Keyed by research entry id. Unpublished work: the question, the method and the status, nothing more. */
export const researchNotebooks: Record<string, NotebookDefinition> = {
  'dialect-erasure': book('research-dialect-erasure', 'Dialect erasure in AI transcription', [
    page('dialect-question', 'Does the dialect survive?', 'When vision-language models read printed Sylheti or Chittagonian, do they quietly “correct” dialect words into Standard Bangla?', 'corpus', ['Dialect item', 'Standard twin', 'Model reads both', 'Did it change?'], 'Manuscript in preparation.'),
    page('dialect-method', 'Matched pairs, several models.', 'Controlled rendered-text test sets with matched dialect and standard items, several open models, and an inference-time fix evaluated on held-out items.', 'evaluation', ['Matched items', 'Several models', 'Inference-time fix', 'Held-out test'], 'Method only; results follow publication.'),
  ]),
  'lookalike-identifiers': book('research-lookalike-identifiers', 'Look-alike Bengali identifiers', [
    page('lookalike-question', 'Same on screen. Different in code.', 'Can two Bengali variable names that render identically be treated as different names by real compilers and interpreters?', 'questions', ['Spelling variants', 'Font rendering', 'Toolchains', 'Unicode checks'], 'Disclosure in progress; no examples published.'),
    page('lookalike-method', 'Generate, render, compile.', 'Systematic generation and font rendering of spelling variants, tested against mainstream language toolchains and the standard normalisation and confusable checks.', 'evaluation', ['Generate variants', 'Render in fonts', 'Run toolchains', 'Check defences'], 'Vendors and Unicode are notified before details are published.'),
  ], 'cobalt'),
  'compiler-constrained-decoding': book('research-compiler-constrained-decoding', 'Compilers as constrained decoders', [
    page('decoder-question', 'Let the compiler steer.', 'Can an ordinary compiler front end, used unchanged, tell a language model early that its code can no longer become a valid program?', 'tree', ['Source', 'Structure', 'Meaning', 'Behaviour'], 'Manuscript in preparation.'),
    page('decoder-method', 'One rule book, used twice.', 'A prefix checker derived from an existing compiler, verified against reference compilers, then used to guide code generation in open code models.', 'workflow', ['Existing compiler', 'Prefix checker', 'Verified vs reference', 'Guided decoding'], 'Method only; larger-model runs in progress.'),
  ]),
  'inventory-censoring': book('research-inventory-censoring', 'Inventory under stockout censoring', [
    page('censored-demand', 'Sales stop at the shelf.', 'When a shop runs out of stock, its sales understate demand on exactly the days demand was high. Can a retailer still certify how often it meets demand?', 'inventory', ['Demand', 'Stock', 'Stockout', 'Service'], 'Manuscript in preparation.'),
    page('censoring-method', 'Randomise a little. Log it.', 'An application of anytime-valid, randomisation-based inference (Waudby-Smith et al., 2024) to inventory decisions, on public retail data and in simulation.', 'evaluation', ['Small randomisation', 'Logged policy', 'Anytime-valid bound', 'Public retail data'], 'Applies Waudby-Smith et al. (2024).'),
  ], 'cobalt'),
};

export const heroNotebook = book('hero', 'An engineer’s field journal', [
  page('opening-study', 'An idea, taking shape.', 'Signal, circuitry and constellations: three ways into the same curiosity about working systems.', 'cover', ['Signal', 'Circuit', 'Constellation']),
  page('systems-map', 'Different systems. One curiosity.', 'A wearable EMG recorder, a civic-data platform, a research app on Oracle and a focus app with a local AI assistant. Before them, a gas alarm and a drone.', 'map', ['AFO recorder', 'CivicLens', 'ResearchHub', 'ZenFlow', 'Gas safety', 'Drone']),
  page('questions-map', 'The questions between.', 'Dialects in AI transcription, look-alike identifiers, compilers as decoders, and inventory under stockouts.', 'questions', ['Dialects', 'Identifiers', 'Compilers', 'Inventory'], 'Unpublished work: questions and status only.'),
]);

export const backgroundNotebook = book('background', 'Background notes', [
  page('earned-milestones', 'Physics was the first spark.', achievements.map(a => `${a.title}: ${a.detail}${a.date ? ` (${a.date})` : ''}.`).join(' '), 'milestones', ['4th nationally / 2022', '2nd regionally', 'HSC talent scholarship', 'Astrophysics qualifier'], 'Sources are in the milestones list.', '04 / 02'),
  page('education', 'Still asking “what if?”', `${profile.degree} at ${profile.university}. Ideas become interesting when a system has to work.`, 'education', ['Computer science', 'Engineering', 'KUET', 'Bangladesh'], 'Original explanatory illustration.', 'KUET'),
  page('community', 'Learning with others.', community.map(c => `${c.title}: ${c.role}, ${c.since.toLowerCase()}.`).join(' '), 'community', community.map(c => c.short)),
]);
