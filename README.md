# Postman API Tests: Toolshop REST API

[![API tests](https://github.com/Mofrh-hue/postman-api-tests/actions/workflows/api-tests.yml/badge.svg)](https://github.com/Mofrh-hue/postman-api-tests/actions/workflows/api-tests.yml)

A Postman collection that tests the REST API of **[Toolshop](https://practicesoftwaretesting.com)**, a public demo web shop built for practising software testing. The tests run from the command line with **Newman**, every push and every Monday in **GitHub Actions**, and produce an HTML report and a JUnit file.

> Portfolio project. The API under test is a public practice API, not a client system. Only read requests and negative login checks with a made-up account are used, so the tests never change data on the shared site.

## What is tested

**Toolshop API collection**: 19 requests and 85 assertions, in four folders:

| Folder | Requests | What it checks |
|---|---|---|
| Products | 9 | Pagination fields and maths, JSON-schema validation of every product, unique ids, product detail matches the list, specs, related products, empty page past the end, sorting by price and name, price-range filter, 404 for an unknown id |
| Categories and brands | 6 | Required fields, every `parent_id` points to a real category, category tree structure, filtering products by category and by brand |
| Search | 2 | Every result matches the search term, and no matches gives an empty result instead of an error |
| Auth (negative) | 2 | A wrong password and an empty body are both rejected with 401 and no access token |

Every response is also checked at collection level for **response time** (under 3 s, set in the environment) and a **JSON content type**.

**Data-driven search collection**: one request run once per row of [`data/search-terms.csv`](data/search-terms.csv): 10 search terms, 50 assertions. Each row sets the term and the expected minimum and maximum number of results. It also covers upper-case input and a term with no matches. Adding a test case means adding a line to the CSV.

## Techniques used

- **Request chaining.** "List products" saves the first product's id, name and price, the page size and the total into collection variables. Later requests use them: they open that product, check its related items, and jump to the last page, where the number of items must equal `total − (last_page − 1) × per_page`. Categories and brands are chained the same way.
- **JSON-schema validation** with `pm.response.to.have.jsonSchema(...)` for products, categories and brands.
- **Data-driven testing** with Newman's `-d` iteration data (CSV).
- **Environments.** The same collections run against the live API or a local mock by switching the environment file.
- **Positive and negative tests.** Covers happy paths, a 404, an empty result and rejected logins.
- **Reports.** Newman writes an HTML report (htmlextra) and JUnit XML, and CI uploads both as an artifact.

## Offline mock: proving the tests can fail

[`mock/server.js`](mock/server.js) is a small Node server with made-up data in the same shape as the real API. The collections run against it with `npm run test:mock`, which needs no network.

It can also **break the API on purpose**, to show that the tests catch real defects:

| Command | Broken behaviour | Tests that fail |
|---|---|---|
| `MOCK_BUG=sort npm run test:mock` | Price sort returns two items swapped | "Prices are in ascending order" |
| `MOCK_BUG=search npm run test:mock` | Search ignores the query | "Every result contains 'pliers'", "Returns an empty result" |
| `MOCK_BUG=login npm run test:mock` | A wrong password is accepted | "Status is 401", "No access token is returned", "Error says Unauthorized" |

A test that never fails proves nothing, so this is how I check that each assertion is meaningful.

## Run it

**In Postman:** import the two files in `collections/` and `environments/toolshop.postman_environment.json`, pick the environment, and run the collection with the Collection Runner. For the data-driven collection, select `data/search-terms.csv` as the data file.

**From the command line:**

```bash
npm install
npm test               # both collections against the live API, reports in reports/
npm run test:api       # main collection only
npm run test:search    # data-driven search only
npm run test:mock      # both collections against the offline mock
```

## Project structure

```
collections/            Postman collections (v2.1)
environments/           Live API and local mock environments
data/search-terms.csv   Test data for the data-driven collection
mock/server.js          Offline mock of the API, with switchable bugs
scripts/                Starts the mock and runs Newman against it
.github/workflows/      CI: mock run + live run with HTML/JUnit reports
```

## Related projects

- **[playwright-ui-api-tests](https://github.com/Mofrh-hue/playwright-ui-api-tests)**: UI and API tests for the same shop in Playwright and TypeScript
- **[qa-manual-testing-portfolio](https://github.com/Mofrh-hue/qa-manual-testing-portfolio)**: the manual test plan, test cases and bug report for the shop

---

Author: **Ahmed Mofrh Fahmy**, QA Test Lead · [GitHub profile](https://github.com/Mofrh-hue)
