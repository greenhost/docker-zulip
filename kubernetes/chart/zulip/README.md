# Zulip

[Zulip](https://zulipchat.com/), the world's most productive chat

Helm chart based on https://github.com/zulip/docker-zulip

## Installation

Copy `values-local.yaml.example`, modify it as instructed in the comments, then
install with the following commands:

```
helm dependency update                      # Get helm dependency charts
helm install -f ./values-local.yaml zulip . # Install Zulip
```

This will show a message on how to reach your Zulip installation and how to
create your first realm. Wait for all your pods to be ready before you continue.
You can run `kubectl get pods` to their current state. Once all pods are ready,
you can run the commands to create a Realm, and you can reach Zulip following
the instructions as well.

### Installing on Minikube

To install this chart on [minikube](https://minikube.sigs.k8s.io/docs/):

Copy `values-minikube.yaml.example` to `values-local.yaml` and add
(auto-generated) passwords to it as instructed in the comments. Run `minikube
start` to start minikube. Then follow the above installation instructions.

## About this helm chart

This helm chart sets up a StatefulSet that runs a Zulip pod, that in turn runs
the [docker-zulip](https://hub.docker.com/r/zulip/docker-zulip/) Dockerized
Zulip version. Configuration of Zulip happens through environment variables that
are defined in the `values.yaml` under `zulip.environment`. These environment
variables are forwarded to the Docker container, you can read more about
configuring Zulip through environment variables
[here](https://github.com/zulip/docker-zulip/#configuration).

### Dependencies

The chart uses Memcached, RabbitMQ and Redis helm charts defined in
the Bitnami Helm repository. Most of these are configured following their
default settings, but you can check
https://github.com/bitnami/charts/tree/master/bitnami/ for more configuration
options of the subcharts.

For PostgreSQL the chart also uses the Bitnami chart to install it on the
Kubernetes cluster. However, in this case we use Zulip's
[zulip-postgresql](https://hub.docker.com/r/zulip/zulip-postgresql) docker
image, because it contains the Postgresql plugins that are needed to run Zulip.
