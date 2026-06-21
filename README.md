# job_seeker_ro_spider — CONNATIX NATIVE EXCHANGE ROMANIA SRL Scraper

[![Oportunitati SI Cariere](https://github.com/sebiboga/connatix-native-exchange-romania-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml/badge.svg)](https://github.com/sebiboga/connatix-native-exchange-romania-srl-nodejs-scraper/actions/workflows/job-seeker-ro-spider.yml)
[![Automation Tests](https://github.com/sebiboga/connatix-native-exchange-romania-srl-nodejs-scraper/actions/workflows/automation-testing.yml/badge.svg)](https://github.com/sebiboga/connatix-native-exchange-romania-srl-nodejs-scraper/actions/workflows/automation-testing.yml)

[![Version](https://img.shields.io/github/package-json/v/sebiboga/connatix-native-exchange-romania-srl-nodejs-scraper?label=version&color=blue)](CHANGELOG.md)
[![Test Results](https://img.shields.io/badge/test--results-HTML-9b59b6)](https://sebiboga.github.io/connatix-native-exchange-romania-srl-nodejs-scraper/test-results/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ESM-F7DF1E?logo=javascript&logoColor=black)](https://ecma-international.org/)
[![Node.js](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpeviitor.ro&label=peviitor.ro)](https://peviitor.ro)
[![API](https://img.shields.io/website?url=https%3A%2F%2Fapi.peviitor.ro%2F&label=api.peviitor.ro)](https://api.peviitor.ro/)
[![SOLR](https://img.shields.io/website?url=https%3A%2F%2Fsolr.peviitor.ro%2Fsolr%2F&label=solr.peviitor.ro)](https://solr.peviitor.ro/solr/)
[![GitHub Pages](https://img.shields.io/github/deployments/sebiboga/connatix-native-exchange-romania-srl-nodejs-scraper/github-pages?label=GitHub%20Pages)](https://sebiboga.github.io/connatix-native-exchange-romania-srl-nodejs-scraper/)

**job_seeker_ro_spider** — un scraper pentru job-urile CONNATIX NATIVE EXCHANGE ROMANIA SRL din România. Extrage anunțurile de pe [JWX Careers](https://jwx.com/careers) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul SOLR.

> **🌱 Derived scraper.** Acest repo este derivat din template-ul [epam-systems-international-srl-nodejs-scraper](https://github.com/sebiboga/epam-systems-international-srl-nodejs-scraper).

## Overview

Proiectul automatizează colectarea zilnică a job-urilor JWX (fost Connatix) din România, menținând board-ul peviitor.ro la zi cu cele mai recente oportunități de carieră.

## Features

- Extrage job-uri din API-ul Greenhouse JWX Careers
- Validează compania via ANAF (CUI, status activ/inactiv, adresă completă)
- **Cache ANAF la 7 zile** — committed în repo, nu lovește demoANAF la fiecare scrape
- **Fallback la cache stale** dacă ANAF e indisponibil
- Cross-validează cu Peviitor API
- Stochează în SOLR (job core + company core)
- Generează `docs/jobs.md` automat — accesibil pe GitHub Pages
- **Identitate companie într-un singur fișier** (`config/company.json`) — derivare ușoară pentru alte companii
- GitHub Actions: scrape zilnic + testare automată (unit, integration, e2e, consistency)
- Teste SOLR condiționale — auto-skip când `SOLR_AUTH` nu e setat
- Se identifică prin User-Agent: `job_seeker_ro_spider`

## Project Structure

```
├── index.js                    # Main scraper entry point
├── company.js                  # Company validation via ANAF + Peviitor + SOLR
├── demoanaf.js                 # CLI wrapper for src/anaf.js
├── solr.js                     # SOLR operations (query, upsert, delete, company)
├── validate-jobs.js            # Job URL validator — checks active/expired, deletes stale jobs
├── config/
│   ├── company.json            # Single source of truth: CIF, brand, URLs, API params
│   └── company.js              # ESM loader for company.json
├── src/
│   ├── anaf.js                 # ANAF API core module (search + company details)
│   ├── markdown-generator.js   # Generates docs/jobs.md from scraped data
│   └── job-validator.js        # Shared validateByHead + validateByContent
├── company.json                # ANAF data cache (committed, 7-day TTL)
├── tests/
│   ├── package.json            # Jest config for test suite
│   ├── company.json            # Mock ANAF data used in unit tests
│   ├── validate-connatix-jobs.js   # SOLR job URL validation script
│   ├── unit/
│   │   ├── index.test.js       # Tests for parseGreenhouseJobs, mapToJobModel, transformJobsForSOLR
│   │   ├── company.test.js     # Tests for validateAndGetCompany, fallback caching
│   │   ├── solr.test.js        # Tests for query, upsert, delete operations
│   │   └── demoanaf.test.js    # Tests for ANAF search and company retrieval
│   ├── integration/
│   │   └── workflow.test.js    # Live ANAF + SOLR integration tests
│   ├── e2e/
│   │   └── scraper.test.js     # Full pipeline tests with real Greenhouse API
│   └── consistency/
│       ├── public.test.js      # Verifies repo is public
│       ├── repo.test.js        # Verifies branch, Pages, secrets, workflows
│       ├── topics.test.js      # Verifies required repo topics
│       └── workflow-naming.test.js  # Validates workflow naming conventions
├── docs/
│   ├── index.html              # Live job board (GitHub Pages)
│   ├── jobs.md                 # Scraped jobs in markdown (generated by CI)
│   ├── README.md
│   └── test-results/           # Test reports (generated by CI)
│       ├── index.html
│       ├── pre-scrape-unit.html
│       ├── pre-scrape-integration.html
│       ├── post-scrape.html
│       └── post-scrape-consistency.html
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       ├── job-seeker-ro-spider.yml     # Daily scraping at 6 AM UTC
│       └── automation-testing.yml       # Automation Tests on push/PR
└── package.json
```

## Setup

### Prerequisites

- Node.js 24+
- npm

### Installation

```bash
npm install
```

### Configuration

Set the `SOLR_AUTH` environment variable with your Solr credentials:

```bash
export SOLR_AUTH="username:password"
```

## Usage

### Run the Scraper

```bash
npm run scrape
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

## Acknowledgments

This project was developed with assistance from **[Claude Code](https://claude.ai/code)** by Anthropic.

Special thanks to the open source community and the peviitor.ro team for their support.

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE

Licensed under the [MIT License](LICENSE).

## Managed By

This project is managed by [ASOCIATIA OPORTUNITATI SI CARIERE](https://oportunitatisicariere.ro) and used as a web scraper for the [peviitor.ro](https://peviitor.ro) job board project.

## Robots.txt Policy

Acest scraper respectă regulile din [robots.txt](https://jwx.com/robots.txt) al JWX. Pentru analiza completă, vezi [ROBOTS.md](ROBOTS.md).

## Disclaimer

This scraper is designed for educational purposes and legitimate job data aggregation for the Romanian job market. Please respect JWX's Terms of Service and robots.txt when using this scraper.
