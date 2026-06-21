# Robots.txt Analysis — jwx.com

## Target site
- **Website:** https://jwx.com
- **Careers page:** https://jwx.com/careers
- **API:** Greenhouse JSON API at `https://boards-api.greenhouse.io/v1/boards/jwp/jobs`
- **robots.txt:** https://jwx.com/robots.txt

## Analysis

The Greenhouse API used by this scraper (`boards-api.greenhouse.io`) is a public API endpoint that serves job listings. The main site (jwx.com) is served behind HubSpot and does not serve the job data directly.

### Scraper behavior:
- Fetches job listings from the public Greenhouse JSON API endpoint
- Does NOT scrape individual job pages from jwx.com
- Uses `User-Agent: job_seeker_ro_spider` for identification
- Implements rate limiting: single request, no concurrent fetches
- Respects the site's resources by using the API directly

### Politeness:
- Single API call to fetch all jobs (no pagination iteration needed)
- Identifiable User-Agent string
- Purpose: legitimate job data aggregation for peviitor.ro (non-commercial, public service)
