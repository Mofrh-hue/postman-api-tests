// Starts the offline mock API, runs both collections against it with Newman,
// then stops the mock. Exit code is 1 if any assertion fails.
//
//   npm run test:mock
//   MOCK_BUG=sort npm run test:mock     (see mock/server.js for the bug switches)

const { spawn } = require('child_process');
const path = require('path');
const newman = require('newman');

const root = path.join(__dirname, '..');
const env = path.join(root, 'environments/mock.postman_environment.json');

function run(options) {
  return new Promise((resolve, reject) => {
    newman.run({ environment: env, reporters: ['cli'], ...options }, (err, summary) => {
      if (err) return reject(err);
      resolve(summary.run.failures.length);
    });
  });
}

const mock = spawn(process.execPath, [path.join(root, 'mock/server.js')], { env: process.env });

mock.stdout.once('data', async chunk => {
  process.stdout.write(chunk);
  let failures = 0;
  try {
    failures += await run({ collection: path.join(root, 'collections/toolshop-api.postman_collection.json') });
    failures += await run({
      collection: path.join(root, 'collections/toolshop-search-data-driven.postman_collection.json'),
      iterationData: path.join(root, 'data/search-terms.csv'),
    });
  } catch (err) {
    console.error(err);
    failures += 1;
  } finally {
    mock.kill();
  }
  console.log(failures ? `\n${failures} failure(s) against the mock` : '\nAll checks passed against the mock');
  process.exit(failures ? 1 : 0);
});

mock.stderr.pipe(process.stderr);
