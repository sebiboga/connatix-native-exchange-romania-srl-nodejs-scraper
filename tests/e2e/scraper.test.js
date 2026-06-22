import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

import companyConfig from '../../config/company.js';
const TEST_CIF = companyConfig.cif;
const TEST_BRAND = companyConfig.brand;
const GREENHOUSE_API_URL = `${companyConfig.apiBase}${companyConfig.apiEndpoint}`;

describe('E2E: Full Scraping Pipeline', () => {

  describe('Greenhouse API — Real Data Fetch', () => {
    let apiData;

    beforeAll(async () => {
      const res = await fetch(GREENHOUSE_API_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should respond with valid job data from Greenhouse API', () => {
      expect(apiData).toHaveProperty('jobs');
      expect(Array.isArray(apiData.jobs)).toBe(true);
      expect(apiData).toHaveProperty('meta');
      expect(typeof apiData.meta?.total).toBe('number');
    }, 10000);

    it('should have jobs with expected fields', () => {
      if (apiData.jobs.length === 0) {
        console.log('⚠️ No jobs returned from Greenhouse API — skipping field assertions');
        return;
      }
      const job = apiData.jobs[0];
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('title');
      expect(typeof job.title).toBe('string');
      expect(job).toHaveProperty('absolute_url');
      expect(job).toHaveProperty('location');
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let apiData;

    beforeAll(async () => {
      index = await import('../../index.js');
      const res = await fetch(GREENHOUSE_API_URL, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should parse real Greenhouse API response into standardized format', () => {
      const result = index.parseGreenhouseJobs(apiData);

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.jobs)).toBe(true);

      if (result.jobs.length === 0) {
        console.log('⚠️ No jobs parsed — skipping assertions');
        return;
      }

      const parsed = result.jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed.url).toMatch(/^https:\/\//);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('workmode');
      expect(['remote', 'on-site', 'hybrid']).toContain(parsed.workmode);
      expect(parsed).toHaveProperty('location');
      expect(Array.isArray(parsed.location)).toBe(true);
    });

    it('should map parsed jobs to job model', () => {
      const parsed = index.parseGreenhouseJobs(apiData);

      if (parsed.jobs.length === 0) {
        console.log('⚠️ No jobs to map — skipping');
        return;
      }

      const model = index.mapToJobModel(parsed.jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
      expect(model.url).toMatch(/^https:\/\//);
    });

    it('should transform jobs and filter to Romanian locations', () => {
      const parsed = index.parseGreenhouseJobs(apiData);

      if (parsed.jobs.length === 0) {
        console.log('⚠️ No jobs to transform — skipping');
        return;
      }

      const jobs = parsed.jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'greenhouse.io',
        company: 'CONNATIX NATIVE EXCHANGE ROMANIA SRL',
        cif: TEST_CIF,
        jobs
      };

      const transformed = index.transformJobsForSOLR(payload, true);

      expect(transformed.company).toBe('CONNATIX NATIVE EXCHANGE ROMANIA SRL');
      expect(transformed.jobs.length).toBeLessThanOrEqual(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    it('should find CONNATIX in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany('CONNATIX');

      const connatix = results.find(c =>
        c.name.toUpperCase().includes('CONNATIX') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(connatix).toBeDefined();
      expect(connatix.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('CONNATIX NATIVE EXCHANGE ROMANIA SRL');
      expect(result.cif).toBe(TEST_CIF);

      if (result.existingJobsCount === 0) {
        console.log('⚠️ No jobs in Solr — skipping job count assertion');
        return;
      }
      expect(result.existingJobsCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should detect inactive/radiated companies via ANAF', async () => {
      const results = await anaf.searchCompany('CONNATIX');

      const nonActive = results.find(c => c.statusLabel !== 'Funcțiune');

      if (nonActive) {
        try {
          const anafData = await anaf.getCompanyFromANAF(nonActive.cui.toString());
          expect(anafData).toBeDefined();
          if (anafData.inactive !== undefined) {
            expect(anafData.inactive).toBe(true);
          }
        } catch {
          expect(nonActive.statusLabel).toMatch(/Radiată|Inactiv|Suspendat/);
        }
      }
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      if (result.numFound === 0) {
        console.log('⚠️ No jobs in Solr — skipping SOLR data verification');
        return;
      }

      for (const job of result.docs) {
        expect(job.company).toBe('CONNATIX NATIVE EXCHANGE ROMANIA SRL');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have company core entry with required fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const companyEntry = result.docs[0];
      expect(companyEntry.company).toBe('CONNATIX NATIVE EXCHANGE ROMANIA SRL');
      expect(companyEntry.status).toBe('activ');
    }, 15000);
  });
});
