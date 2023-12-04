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

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { CreateCloudDeployReleaseOutputs } from '../../src/main';
import { parseCreateReleaseResponse } from '../../src/output-parser';

describe('#output-parser', async () => {
  describe('#parseCreateReleaseResponse', async () => {
    const cases: {
      name: string;
      stdout: string | undefined;
      error?: string;
      expected?: CreateCloudDeployReleaseOutputs;
    }[] = [
      {
        name: 'parses create release outputs (with rollout)',
        stdout: `
          [
            {
              "annotations": {
                "commit": "https://github.com/dummy-org/dummy-app/commit/ede1c221e4c253e7009157f1f19b3f9040a19b97"
              },
              "buildArtifacts": [
                {
                  "image": "dummy-app",
                  "tag": "image:1"
                }
              ],
              "createTime": "2023-01-09T11:42:53.689671156Z",
              "deliveryPipelineSnapshot": {
                "createTime": "2022-09-30T15:45:26.161965Z",
                "description": "Deployment pipeline for dummy-app",
                "etag": "869057dad135a00",
                "name": "projects/112233445566/locations/dummy-region1/deliveryPipelines/dummy-app",
                "serialPipeline": {
                  "stages": [
                    {
                      "profiles": [
                        "test"
                      ],
                      "targetId": "test"
                    },
                    {
                      "profiles": [
                        "staging"
                      ],
                      "targetId": "staging"
                    },
                    {
                      "profiles": [
                        "prod"
                      ],
                      "targetId": "prod"
                    }
                  ]
                },
                "uid": "d542bd0e9c964c5ba41da35f6ceb2d7f",
                "updateTime": "2022-10-05T11:45:34.756506Z"
              },
              "etag": "97c3920b5a514d1e",
              "name": "projects/dummy-project/locations/dummy-region1/deliveryPipelines/dummy-app/releases/dummy-app-abc1234",
              "renderState": "IN_PROGRESS",
              "skaffoldConfigUri": "gs://d542bd0e9c964c5ba41da35f6ceb2d7f_clouddeploy/source/1673264571.641767-b9a12c12412f4b2f84bbec2a29f1d50f.tgz",
              "skaffoldVersion": "skaffold_preview",
              "targetRenders": {
                "prod": {
                  "renderingBuild": "projects/112233445566/locations/dummy-region1/builds/73440a33-b517-425d-9ced-12033ffed5ed",
                  "renderingState": "IN_PROGRESS"
                },
                "staging": {
                  "renderingBuild": "projects/112233445566/locations/dummy-region1/builds/a6460d8c-e4af-4445-a0b6-880607c7b032",
                  "renderingState": "IN_PROGRESS"
                },
                "test": {
                  "renderingBuild": "projects/112233445566/locations/dummy-region1/builds/1d522ae2-8a45-4ed0-851c-9edccd246736",
                  "renderingState": "IN_PROGRESS"
                }
              },
              "targetSnapshots": [
                {
                  "createTime": "2022-10-05T11:45:37.430946Z",
                  "description": "Test target",
                  "etag": "d08f127aabf77363",
                  "name": "projects/112233445566/locations/dummy-region1/targets/test",
                  "run": {
                    "location": "projects/dummy-project/locations/dummy-region1"
                  },
                  "targetId": "test",
                  "uid": "814fb1ee99114bfcaf1055050f0a19e5",
                  "updateTime": "2022-10-05T11:45:37.430946Z"
                },
                {
                  "createTime": "2022-10-05T11:45:38.230629Z",
                  "description": "Staging target",
                  "etag": "54fdc76527ba5c6c",
                  "name": "projects/112233445566/locations/dummy-region1/targets/staging",
                  "run": {
                    "location": "projects/dummy-project/locations/dummy-region1"
                  },
                  "targetId": "staging",
                  "uid": "11a46f397f4c4336a942f659e935069b",
                  "updateTime": "2022-10-05T11:45:38.230629Z"
                },
                {
                  "createTime": "2022-10-05T11:45:38.995503Z",
                  "description": "Production target",
                  "etag": "28b624ddd4f1dad2",
                  "name": "projects/112233445566/locations/dummy-region1/targets/prod",
                  "requireApproval": true,
                  "run": {
                    "location": "projects/dummy-project/locations/dummy-region1"
                  },
                  "targetId": "prod",
                  "uid": "036c334205e442fdb3a131127d3a6424",
                  "updateTime": "2022-10-05T11:45:38.995503Z"
                }
              ],
              "uid": "42ea7ee3e4ce474fb1cf904614701c04"
            },
            {
              "approvalState": "DOES_NOT_NEED_APPROVAL",
              "createTime": "2023-01-09T11:43:00.340200059Z",
              "etag": "c7862d6da90f32e",
              "name": "projects/dummy-project/locations/dummy-region1/deliveryPipelines/dummy-app/releases/dummy-app-abc1234/rollouts/dummy-app-abc1234-to-test-0001",
              "phases": [
                {
                  "deploymentJobs": {
                    "deployJob": {
                      "deployJob": {},
                      "id": "deploy",
                      "state": "PENDING"
                    },
                    "verifyJob": {
                      "id": "verify",
                      "state": "DISABLED",
                      "verifyJob": {}
                    }
                  },
                  "id": "stable",
                  "state": "PENDING"
                }
              ],
              "state": "PENDING_RELEASE",
              "targetId": "test",
              "uid": "00b6739f46cf44b3bf51110a2a82b3de"
            }
          ]
          `,
        expected: {
          link: 'https://console.cloud.google.com/deploy/delivery-pipelines/dummy-region1/dummy-app/releases/dummy-app-abc1234?project=dummy-project',
          name: 'projects/dummy-project/locations/dummy-region1/deliveryPipelines/dummy-app/releases/dummy-app-abc1234',
        },
      },
      {
        name: 'parses create release outputs (without rollout)',
        stdout: `
          {
            "annotations": {
              "commit": "https://github.com/dummy-org/dummy-app/commit/ede1c221e4c253e7009157f1f19b3f9040a19b97"
            },
            "buildArtifacts": [
              {
                "image": "dummy-app",
                "tag": "image:1"
              }
            ],
            "createTime": "2023-01-09T11:42:53.689671156Z",
            "deliveryPipelineSnapshot": {
              "createTime": "2022-09-30T15:45:26.161965Z",
              "description": "Deployment pipeline for dummy-app",
              "etag": "869057dad135a00",
              "name": "projects/112233445566/locations/dummy-region1/deliveryPipelines/dummy-app",
              "serialPipeline": {
                "stages": [
                  {
                    "profiles": [
                      "test"
                    ],
                    "targetId": "test"
                  },
                  {
                    "profiles": [
                      "staging"
                    ],
                    "targetId": "staging"
                  },
                  {
                    "profiles": [
                      "prod"
                    ],
                    "targetId": "prod"
                  }
                ]
              },
              "uid": "d542bd0e9c964c5ba41da35f6ceb2d7f",
              "updateTime": "2022-10-05T11:45:34.756506Z"
            },
            "etag": "97c3920b5a514d1e",
            "name": "projects/dummy-project/locations/dummy-region1/deliveryPipelines/dummy-app/releases/dummy-app-abc1234",
            "renderState": "IN_PROGRESS",
            "skaffoldConfigUri": "gs://d542bd0e9c964c5ba41da35f6ceb2d7f_clouddeploy/source/1673264571.641767-b9a12c12412f4b2f84bbec2a29f1d50f.tgz",
            "skaffoldVersion": "skaffold_preview",
            "targetRenders": {
              "prod": {
                "renderingBuild": "projects/112233445566/locations/dummy-region1/builds/73440a33-b517-425d-9ced-12033ffed5ed",
                "renderingState": "IN_PROGRESS"
              },
              "staging": {
                "renderingBuild": "projects/112233445566/locations/dummy-region1/builds/a6460d8c-e4af-4445-a0b6-880607c7b032",
                "renderingState": "IN_PROGRESS"
              },
              "test": {
                "renderingBuild": "projects/112233445566/locations/dummy-region1/builds/1d522ae2-8a45-4ed0-851c-9edccd246736",
                "renderingState": "IN_PROGRESS"
              }
            },
            "targetSnapshots": [
              {
                "createTime": "2022-10-05T11:45:37.430946Z",
                "description": "Test target",
                "etag": "d08f127aabf77363",
                "name": "projects/112233445566/locations/dummy-region1/targets/test",
                "run": {
                  "location": "projects/dummy-project/locations/dummy-region1"
                },
                "targetId": "test",
                "uid": "814fb1ee99114bfcaf1055050f0a19e5",
                "updateTime": "2022-10-05T11:45:37.430946Z"
              },
              {
                "createTime": "2022-10-05T11:45:38.230629Z",
                "description": "Staging target",
                "etag": "54fdc76527ba5c6c",
                "name": "projects/112233445566/locations/dummy-region1/targets/staging",
                "run": {
                  "location": "projects/dummy-project/locations/dummy-region1"
                },
                "targetId": "staging",
                "uid": "11a46f397f4c4336a942f659e935069b",
                "updateTime": "2022-10-05T11:45:38.230629Z"
              },
              {
                "createTime": "2022-10-05T11:45:38.995503Z",
                "description": "Production target",
                "etag": "28b624ddd4f1dad2",
                "name": "projects/112233445566/locations/dummy-region1/targets/prod",
                "requireApproval": true,
                "run": {
                  "location": "projects/dummy-project/locations/dummy-region1"
                },
                "targetId": "prod",
                "uid": "036c334205e442fdb3a131127d3a6424",
                "updateTime": "2022-10-05T11:45:38.995503Z"
              }
            ],
            "uid": "42ea7ee3e4ce474fb1cf904614701c04"
          }
          `,
        expected: {
          link: 'https://console.cloud.google.com/deploy/delivery-pipelines/dummy-region1/dummy-app/releases/dummy-app-abc1234?project=dummy-project',
          name: 'projects/dummy-project/locations/dummy-region1/deliveryPipelines/dummy-app/releases/dummy-app-abc1234',
        },
      },
      {
        name: 'fails on empty stdout',
        stdout: '',
        error: 'no output from create release command',
      },
      {
        name: 'fails on empty array from stdout',
        stdout: '[]',
        error: 'no output from create release command',
      },
      {
        name: 'fails on empty object from stdout',
        stdout: '{}',
        error: 'no output from create release command',
      },
      {
        name: 'fails on invalid text from stdout',
        stdout: 'Some text to fail',
        error: `failed to parse create release response: unexpected token 'S', "Some text to fail" is not valid JSON, stdout: Some text to fail`,
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, async () => {
        if (tc.error) {
          assert.throws(() => {
            parseCreateReleaseResponse(tc.stdout);
          }, new RegExp(tc.error));
        } else {
          const result = parseCreateReleaseResponse(tc.stdout);
          assert.deepStrictEqual(result, tc.expected);
        }
      });
    });
  });
});
