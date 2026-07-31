import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173';
const LIGHTHOUSE_PACKAGE = process.env.LIGHTHOUSE_PACKAGE || 'lighthouse@13.3.0';
const REPORT_DIR = process.env.LIGHTHOUSE_REPORT_DIR || path.join(ROOT, 'performance', 'lighthouse-reports');
const SUMMARY_DIR = process.env.LIGHTHOUSE_SUMMARY_DIR || path.join(ROOT, 'performance');
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const REPETITIONS = Math.max(1, Number.parseInt(process.env.LIGHTHOUSE_RUNS || '3', 10));

const pages = [
  { key: 'homepage', label: 'Homepage', pathname: '/' },
  { key: 'commercial-landing', label: 'Commercial landing', pathname: '/shop/unstitched-suits-pakistan/' },
  { key: 'formal-landing', label: 'Formal landing', pathname: '/shop/formal-unstitched-suits/' },
  { key: 'luxury-landing', label: 'Luxury landing', pathname: '/shop/luxury-lawn-suits/' },
  { key: 'collection', label: 'Collection', pathname: '/collections/aifa/' },
  { key: 'collection-page-2', label: 'Paginated collection', pathname: '/collections/anaya-noor/page/2/' },
  { key: 'active-product', label: 'Active product', pathname: '/products/aifa-lwn-3p-aiis-26301-aifa-digital-printed-and-embroidered-lawn-3pc/' },
  { key: 'discontinued-product', label: 'Discontinued product', pathname: '/products/bareze-emblwn-v2-3p-re-13-bareeze-plain-emb-lawn-with-chiffone-dupatta-3pc/' },
  { key: 'custom-404', label: 'Custom 404 document', pathname: '/404.html' },
  { key: 'policies', label: 'Policies', pathname: '/policies.html' }
];

const profiles = [
  { key: 'mobile', args: ['--form-factor=mobile'] },
  { key: 'desktop', args: ['--preset=desktop'] }
];

function score(category) {
  return category?.score == null ? null : Math.round(category.score * 100);
}

function milliseconds(audit) {
  return audit?.numericValue == null ? null : Math.round(audit.numericValue);
}

function decimal(audit, places = 3) {
  return audit?.numericValue == null ? null : Number(audit.numericValue.toFixed(places));
}

function median(values, places = null) {
  const usable = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  const value = usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
  return places == null ? Math.round(value) : Number(value.toFixed(places));
}

function display(value, suffix = '') {
  return value == null ? 'n/a' : `${value}${suffix}`;
}

async function runAudit(page, profile, runNumber) {
  const url = new URL(page.pathname, BASE_URL).href;
  const output = path.join(REPORT_DIR, `${page.key}-${profile.key}-run-${runNumber}.json`);
  const args = [
    '--yes',
    LIGHTHOUSE_PACKAGE,
    url,
    '--quiet',
    '--output=json',
    `--output-path=${output}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--throttling-method=simulate',
    '--max-wait-for-load=45000',
    `--chrome-path=${CHROME_PATH}`,
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
    ...profile.args
  ];

  console.log(`Auditing ${page.label} (${profile.key}) — run ${runNumber}/${REPETITIONS} — ${url}`);
  const execution = spawnSync('npx', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024
  });

  if (execution.status !== 0) {
    console.error(execution.stdout);
    console.error(execution.stderr);
    throw new Error(`Lighthouse failed for ${page.key}/${profile.key}/run-${runNumber} with exit code ${execution.status}.`);
  }

  const lhr = JSON.parse(await fs.readFile(output, 'utf8'));
  if (lhr.runtimeError) throw new Error(`${page.key}/${profile.key}/run-${runNumber}: ${lhr.runtimeError.code} — ${lhr.runtimeError.message}`);

  return {
    run: runNumber,
    lighthouseVersion: lhr.lighthouseVersion,
    fetchTime: lhr.fetchTime,
    scores: {
      performance: score(lhr.categories.performance),
      accessibility: score(lhr.categories.accessibility),
      bestPractices: score(lhr.categories['best-practices']),
      seo: score(lhr.categories.seo)
    },
    metrics: {
      fcpMs: milliseconds(lhr.audits['first-contentful-paint']),
      lcpMs: milliseconds(lhr.audits['largest-contentful-paint']),
      tbtMs: milliseconds(lhr.audits['total-blocking-time']),
      cls: decimal(lhr.audits['cumulative-layout-shift']),
      speedIndexMs: milliseconds(lhr.audits['speed-index']),
      serverResponseMs: milliseconds(lhr.audits['server-response-time'])
    }
  };
}

function summarize(page, profile, runs) {
  return {
    page: page.key,
    label: page.label,
    pathname: page.pathname,
    profile: profile.key,
    repetitions: runs.length,
    lighthouseVersion: runs[0]?.lighthouseVersion || null,
    fetchTimes: runs.map(run => run.fetchTime),
    scores: {
      performance: median(runs.map(run => run.scores.performance)),
      accessibility: median(runs.map(run => run.scores.accessibility)),
      bestPractices: median(runs.map(run => run.scores.bestPractices)),
      seo: median(runs.map(run => run.scores.seo))
    },
    metrics: {
      fcpMs: median(runs.map(run => run.metrics.fcpMs)),
      lcpMs: median(runs.map(run => run.metrics.lcpMs)),
      tbtMs: median(runs.map(run => run.metrics.tbtMs)),
      cls: median(runs.map(run => run.metrics.cls), 3),
      speedIndexMs: median(runs.map(run => run.metrics.speedIndexMs)),
      serverResponseMs: median(runs.map(run => run.metrics.serverResponseMs))
    },
    runs
  };
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.mkdir(SUMMARY_DIR, { recursive: true });

  const results = [];
  for (const page of pages) {
    for (const profile of profiles) {
      const runs = [];
      for (let runNumber = 1; runNumber <= REPETITIONS; runNumber += 1) {
        runs.push(await runAudit(page, profile, runNumber));
      }
      results.push(summarize(page, profile, runs));
    }
  }

  const summary = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    lighthousePackage: LIGHTHOUSE_PACKAGE,
    representativePages: pages.length,
    profiles: profiles.map(profile => profile.key),
    repetitionsPerPageProfile: REPETITIONS,
    aggregation: 'median',
    results
  };

  await fs.writeFile(path.join(SUMMARY_DIR, 'lighthouse-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const rows = results.map(result => [
    result.label,
    result.profile,
    display(result.scores.performance),
    display(result.metrics.lcpMs, ' ms'),
    display(result.metrics.fcpMs, ' ms'),
    display(result.metrics.tbtMs, ' ms'),
    display(result.metrics.cls),
    display(result.metrics.speedIndexMs, ' ms'),
    display(result.scores.accessibility),
    display(result.scores.bestPractices),
    display(result.scores.seo)
  ].join(' | '));

  const markdown = [
    '# Phase 4A Lighthouse Staging Results',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `Lighthouse package: \`${LIGHTHOUSE_PACKAGE}\``,
    '',
    `Aggregation: median of ${REPETITIONS} runs per page and device profile.`,
    '',
    '> These are controlled local-server laboratory measurements from GitHub Actions, not Chrome UX Report field data and not production-origin PageSpeed results.',
    '',
    'Page | Profile | Performance | LCP | FCP | TBT | CLS | Speed Index | Accessibility | Best Practices | SEO',
    '--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:',
    ...rows,
    ''
  ].join('\n');

  await fs.writeFile(path.join(SUMMARY_DIR, 'lighthouse-summary.md'), markdown);
  console.log(`Completed ${results.length * REPETITIONS} Lighthouse audits and summarized ${results.length} page/profile medians.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});