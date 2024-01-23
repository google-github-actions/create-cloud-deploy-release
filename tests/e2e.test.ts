/*
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test } from 'node:test';
import assert from 'node:assert';

import { clouddeploy_v1 } from 'googleapis';
import { getExecOutput } from '@actions/exec';
import yaml from 'js-yaml';

import { skipIfMissingEnv } from '@google-github-actions/actions-utils';

test(
  'e2e tests',
  {
    concurrency: true,
    skip: skipIfMissingEnv('NAME', 'DELIVERY_PIPELINE', 'PROJECT_ID', 'REGION'),
  },
  async (suite) => {
    let release: clouddeploy_v1.Schema$Release;

    suite.before(async () => {
      const args = [
        'deploy',
        'releases',
        'describe',
        process.env.NAME!,
        '--delivery-pipeline',
        process.env.DELIVERY_PIPELINE!,
        '--project',
        process.env.PROJECT_ID!,
        '--format',
        'yaml',
        '--region',
        process.env.REGION!,
      ];

      const output = await getExecOutput('gcloud', args);
      release = yaml.load(output.stdout) as clouddeploy_v1.Schema$Release;

      if (!release) {
        throw new Error('failed to find release');
      }
    });

    await suite.test(
      'has the correct annotations',
      { skip: skipIfMissingEnv('ANNOTATIONS') },
      async () => {
        const expected = JSON.parse(process.env.ANNOTATIONS!);
        const actual = release?.annotations || {};

        // Filter out only the keys we care about
        const subset = Object.assign({}, ...Object.keys(expected).map((k) => ({ [k]: actual[k] })));

        assert.deepStrictEqual(subset, expected);
      },
    );

    await suite.test(
      'has the correct description',
      { skip: skipIfMissingEnv('DESCRIPTION') },
      async () => {
        const actual = release?.description;
        assert.deepStrictEqual(actual, process.env.DESCRIPTION!);
      },
    );

    await suite.test('has the correct name', { skip: skipIfMissingEnv('NAME') }, async () => {
      const actual = release?.name;
      assert.deepStrictEqual(actual, process.env.NAME!);
    });

    await suite.test('has the correct labels', { skip: skipIfMissingEnv('LABELS') }, async () => {
      const expected = JSON.parse(process.env.LABELS!);
      const actual = release?.labels;
      assert.deepStrictEqual(actual, expected);
    });
  },
);
