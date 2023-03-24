# create-cloud-deploy-release

The `create-cloud-deploy-release` GitHub Action creates a [Cloud Deploy][cd]
[release][cd-release] to manage the deployment of an application to one or more
[Google Kubernetes Engine (GKE)][gke], [Anthos][anthos], or [Cloud Run][cloud-run]
[targets][cd-target].

## Prerequisites

-   This action requires Google Cloud credentials that are authorized to access
    the secrets being requested. See [Authorization](#authorization) for more
    information.

-   This action runs using Node 16. If you are using self-hosted GitHub Actions
    runners, you must use runner version
    [2.285.0](https://github.com/actions/virtual-environments) or newer.

-   This action depends on the existence of a [Cloud Deploy][cd]
    [delivery pipeline][cd-pipeline] that is configured for the targets to which
    the application will be deployed.

## Usage

```yaml
jobs:
  job_id:
    # ...

    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: 'actions/checkout@v3'

    - uses: 'google-github-actions/auth@v1'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

   - id: create-release
     uses: 'google-github-actions/create-cloud-deploy-release@v1'
      with:
        name: 'demo-app-v1.2.3'
        description: 'Add new functionality to demo-app'
        delivery_pipeline: 'demo-app-pipeline'
        region: 'us-central1'
        images: 'demo-app=us-central1-docker.pkg.dev/demo-app-project/demo-app-repo/demo-app:v1.2.3'
        source: 'demo-app'
```

## Inputs

-   `name`: (Required) The name for the release.

-   `delivery_pipeline` (Required): The [delivery pipeline][cd-pipeline] to use
    for the release.

-   `source`: (Required) The location of the files to be included in the
    release; typically application configuration manifests.

-   `build_artifacts`: (Required, unless providing `images`) Path to a
    [Skaffold output file][skaffold-output] containing the details of the
    application image(s) to be released.

-   `images`: (Required, unless providing `build_artifacts`) The details of the
    application image(s) to be released, in the format
    `image1=path/to/image1:v1@sha256:45db24`, for example:

    ```yaml
    with:
      images: |-
        image1=image.repo/path/to/image1:v1@sha256:45db24
        image2=image.repo/path/to/image2:v1@sha256:f32780
    ```

-   `region`: (Optional) Region of the delivery pipeline. If not supplied, a
    previously configured `gcloud` setting using `deploy/region` is required,
    for example `gcloud config set deploy/region [REGION]`.

-   `disable_initial_rollout`: (Optional) Prevent the release being deployed to
    the first target in the delivery pipeline.

-   `gcs_source_staging_dir`: (Optional) A directory in Google Cloud Storage to
    copy the source used for staging the build.

-   `skaffold_file`: (Optional) Path of the skaffold file absolute or relative
    to the source directory.

-   `annotations`: (Optional) Add additional annotations to the release.

    ```yaml
    with:
      annotations: |-
        annotation1=value1
        annotation2=value2
    ```

    The GitHub Action will automatically apply the following annotations to the
    release to enhance the user experience:

    ```text
    git-sha: ecdeca633a230bfade4cc8195ae23af030922319
    commit: <commit>
    ```

-   `labels`: (Optional) Add additional labels to the release.

    ```yaml
    with:
      labels: |-
        label1=value1
        label2=value2
    ```

    The GitHub Action will automatically apply the following label to the
    release to enhance the user experience:

    ```text
    managed-by: github-actions
    ```

    Labels have strict naming and casing requirements. See [Requirements for
    labels](https://cloud.google.com/resource-manager/docs/creating-managing-labels#requirements)
    for more information.

-   `description`: (Optional) Include a description of the release.

-   `flags`: (Optional) Space separated list of other Cloud Deploy flags,
    examples can be found [here][cd-flags]. This can be used to access features
    that are not exposed via this GitHub Action.

    ```yaml
    with:
      flags: '--from-k8s-manifest=...'
    ```

-   `gcloud_version`: (Optional) Version of the Cloud SDK to install. If
    unspecified or set to "latest", the latest available gcloud SDK version for
    the target platform will be installed. Example: "290.0.1".

-   `gcloud_component`: (Optional) Version of the Cloud SDK components to
    install and use. If unspecified, the latest or released version will be
    used. This is the equivalent of running 'gcloud alpha run' or 'gcloud beta
    run'. Valid values are `alpha` or `beta`.

## Outputs

-   `name`: The full name of the release in Cloud Deploy, including project and
    pipeline names, as well as the chosen name of the release itself.

-   `link`: A link to the Cloud Deploy release in the Google Cloud Web Console.

## Authorization

There are a few ways to authenticate this action. The caller must have
permissions to access the secrets being requested.

You will need to authenticate to Google Cloud as a service account with the
following roles:

-   Cloud Deploy Releaser (`roles/clouddeploy.releaser`)
    -   Can create and retrieve releases and rollouts

This service account needs to be a member of the service account used by Cloud
Deploy, with role `Service Account User`. To grant a user permissions for a
service account, use one of the methods found in [Configuring Ownership and
access to a service account](https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_user_for_a_service_account)

By default, Cloud Deploy itself will use the `Compute Engine default service
account`, `(PROJECT_NUMBER-compute@developer.gserviceaccount.com)` as described
in the documentation for [IAM within Cloud Deploy][cd-iam]. This service
account must have the `roles/clouddeploy.jobRunner` role in the Cloud Deploy
project. Alternatively you may choose to configure Cloud Deploy to use a custom
service account [as detailed in the Cloud Deploy documentation][cd-custom-sa].

The service account used by Cloud Deploy additionally needs permisisons that
allow deployment of a service to your target runtime, [GKE][gke] or
[Cloud Run][cloud-run], as described in the following sections.

### Cloud Run Authorization

To deploy to Cloud Run, the service account used by Cloud Deploy needs the following permissions:

-   Cloud Run Developer (`roles/run.developer`)
    -   Read and write access to all Cloud Run resources.

The service account additionally needs to be a member of the service account
used by Cloud Run, with role `Service Account User`. This may be the `Compute
Engine default service account,
(PROJECT_NUMBER-compute@developer.gserviceaccount.com)` or a custom service
account, depending on your configuration. To grant a user permissions for a
service account, use one of the methods found in [Configuring Ownership and
access to a service account](https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_user_for_a_service_account)

### GKE Authorization

To deploy to GKE, the service account used by Cloud Deploy needs the following permissions:

-   Kubernetes Engine Developer (`roles/container.developer`)
    -   Provides access to Kubernetes API objects inside clusters.

### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth)
to authenticate the action. You can use [Workload Identity Federation][wif] or
traditional [Service Account Key JSON][sa] authentication.

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:

    # ...

    - uses: 'google-github-actions/auth@v1'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - uses: 'google-github-actions/create-cloud-deploy-release@v1'
      with:
        name: 'example-app'
        ...
```

### Via Application Default Credentials

If you are hosting your own runners, **and** those runners are on Google Cloud,
you can leverage the Application Default Credentials of the instance. This will
authenticate requests as the service account attached to the instance. **This
only works using a custom runner hosted on GCP.**

```yaml
jobs:
  job_id:
    steps:
    # ...

    - uses: 'google-github-actions/create-cloud-deploy-release@v1'
      with:
        name: 'example-app'
        ...
```

The action will automatically detect and use the Application Default
Credentials.

## Example Workflows

-   [Example workflows][examples] for `create-cloud-deploy-release`

## Versioning

We recommend pinning to the latest available major version:

```yaml
- uses: 'google-github-actions/create-cloud-deploy-release@v1'
```

While this action attempts to follow semantic versioning, but we're ultimately
human and sometimes make mistakes. To prevent accidental breaking changes, you
can also pin to a specific version:

```yaml
- uses: 'google-github-actions/create-cloud-deploy-release@v1.0.0'
```

However, you will not get automatic security updates or new features without
explicitly updating your version number. Note that we only publish `MAJOR` and
`MAJOR.MINOR.PATCH` versions. There is **not** a floating alias for
`MAJOR.MINOR`.

[anthos]: https://cloud.google.com/anthos
[cd]: https://cloud.google.com/deploy
[cd-custom-sa]: https://cloud.google.com/deploy/docs/cloud-deploy-service-account#what_service_accounts_to_create
[cd-iam]: https://cloud.google.com/deploy/docs/cloud-deploy-service-account#execution_service_account
[cd-flags]: https://cloud.google.com/sdk/gcloud/reference/deploy/releases/create#FLAGS
[cd-pipeline]: https://cloud.google.com/deploy/docs/terminology#delivery_pipeline
[cd-release]: https://cloud.google.com/deploy/docs/terminology#release
[cd-target]: https://cloud.google.com/deploy/docs/terminology#target
[cloud-run]: https://cloud.google.com/run
[examples]: https://github.com/google-github-actions/example-workflows/tree/main/workflows/create-cloud-deploy-release
[gke]: https://cloud.google.com/kubernetes-engine
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[skaffold-output]: https://skaffold.dev/docs/workflows/ci-cd/#traditional-continuous-delivery
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
