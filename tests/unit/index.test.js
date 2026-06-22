import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../index.js');
  });

  describe('transformJobsForSOLR', () => {
    it('should filter locations to only Romanian cities', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Bucharest'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['Bulgaria'] },
          { url: 'https://test.com/4', title: 'Job 4', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/5', title: 'Job 5', location: [] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].location).toEqual(['Bucharest']);
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[3].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[4].location).toEqual(['România']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'greenhouse.io',
        company: 'connatix native exchange romania srl',
        cif: '35861771',
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', company: 'connatix', cif: '35861771' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('CONNATIX NATIVE EXCHANGE ROMANIA SRL');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://test.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://test.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://test.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });

    it('should exclude non-Romanian locations when filterNonRomanian=true', () => {
      const payload = {
        jobs: [
          { url: 'https://test.com/1', title: 'Job 1', location: ['România'] },
          { url: 'https://test.com/2', title: 'Job 2', location: ['Cluj-Napoca'] },
          { url: 'https://test.com/3', title: 'Job 3', location: ['London'], workmode: 'on-site' },
          { url: 'https://test.com/4', title: 'Job 4', location: ['New York'], workmode: 'on-site' },
          { url: 'https://test.com/5', title: 'Job 5', location: ['Remote'], workmode: 'remote' },
          { url: 'https://test.com/6', title: 'Job 6', location: [], workmode: 'on-site' },
          { url: 'https://test.com/7', title: 'Job 7', location: ['UK, NL'], workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload, true);

      expect(result.jobs).toHaveLength(3);
      expect(result.jobs[0].url).toBe('https://test.com/1');
      expect(result.jobs[0].location).toEqual(['România']);
      expect(result.jobs[1].url).toBe('https://test.com/2');
      expect(result.jobs[1].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[2].url).toBe('https://test.com/5');
      expect(result.jobs[2].location).toEqual(['România']);
      expect(result.jobs[2].workmode).toBe('remote');
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://jwx.com/careers/job-posting?gh_jid=123',
        title: 'Software Engineer',
        location: ['Cluj-Napoca'],
        tags: ['engineering'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'CONNATIX NATIVE EXCHANGE ROMANIA SRL';
      const COMPANY_CIF = '35861771';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.tags).toEqual(rawJob.tags);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should remove undefined fields', () => {
      const rawJob = {
        url: 'https://test.com/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '35861771');

      expect(result.location).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.workmode).toBeUndefined();
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://test.com/1' };

      const result = index.mapToJobModel(rawJob, '35861771');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://test.com/1');
    });
  });

  describe('parseGreenhouseJobs', () => {
    it('should parse Greenhouse API response format', () => {
      const apiData = {
        jobs: [
          {
            id: 123,
            title: 'Software Engineer',
            absolute_url: 'https://jwx.com/careers/job-posting?gh_jid=123',
            location: { name: 'Cluj-Napoca' },
            departments: [{ name: 'Engineering' }],
            offices: [{ name: 'Cluj-Napoca' }]
          }
        ],
        meta: { total: 1 }
      };

      const result = index.parseGreenhouseJobs(apiData);

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Software Engineer');
      expect(result.jobs[0].url).toBe('https://jwx.com/careers/job-posting?gh_jid=123');
      expect(result.jobs[0].location).toEqual(['Cluj-Napoca']);
    });

    it('should handle empty job list', () => {
      const apiData = { jobs: [], meta: { total: 0 } };

      const result = index.parseGreenhouseJobs(apiData);

      expect(result.jobs).toEqual([]);
    });

    it('should handle missing data field', () => {
      const result = index.parseGreenhouseJobs({});

      expect(result.jobs).toEqual([]);
    });

    it('should map departments to tags', () => {
      const apiData = {
        jobs: [
          {
            id: 456,
            title: 'Developer',
            absolute_url: 'https://jwx.com/careers/job-posting?gh_jid=456',
            location: { name: 'Bucharest' },
            departments: [{ name: 'Engineering' }, { name: 'Product' }]
          }
        ],
        meta: { total: 1 }
      };

      const result = index.parseGreenhouseJobs(apiData);

      expect(result.jobs[0].tags).toEqual(['engineering', 'product']);
    });
  });

  describe('URL Generation', () => {
    it('should use absolute_url from Greenhouse API', () => {
      const apiData = {
        jobs: [
          {
            id: 789,
            title: 'Test Job',
            absolute_url: 'https://jwx.com/careers/job-posting?gh_jid=789',
            location: { name: 'Cluj-Napoca' }
          }
        ],
        meta: { total: 1 }
      };

      const result = index.parseGreenhouseJobs(apiData);

      expect(result.jobs[0].url).toBe('https://jwx.com/careers/job-posting?gh_jid=789');
    });
  });
});
