# Build + push SEMUA image Nexus secara PARALEL.
#
# Pakai:
#   cd nexus-integration
#   docker buildx use nexus-builder
#   docker buildx bake --push
#
# Override namespace / tag kalau perlu:
#   NS=akunmu TAG=v1 docker buildx bake --push

variable "NS"  { default = "scientivan" }   # namespace Docker Hub
variable "TAG" { default = "latest" }

# Semua image target server: linux/amd64 saja.
# provenance/sbom dimatikan -> tidak ada attestation manifest ekstra = push lebih sedikit & cepat.
function "common" {
  params = []
  result = {
    platforms  = ["linux/amd64"]
    provenance = false
    sbom       = false
  }
}

group "default" {
  targets = ["svc-auth", "svc-bidding", "svc-match", "svc-audit", "svc-notify", "gateway"]
}

target "svc-auth" {
  context = "../../kelompok1-identity-and-sso-service"
  target  = "dev"
  tags     = ["${NS}/nexus-svc-auth:${TAG}"]
  platforms  = ["linux/amd64"]
  provenance = false
  sbom       = false
}

target "svc-bidding" {
  context = "../../kelompok2-project-bidding-service"
  target  = "development"
  tags     = ["${NS}/nexus-svc-bidding:${TAG}"]
  platforms  = ["linux/amd64"]
  provenance = false
  sbom       = false
}

target "svc-match" {
  context = "../../kelompok3-team-matching-service"
  tags     = ["${NS}/nexus-svc-match:${TAG}"]
  platforms  = ["linux/amd64"]
  provenance = false
  sbom       = false
}

target "svc-audit" {
  context    = "../backend"
  dockerfile = "dockerfile"
  tags       = ["${NS}/nexus-svc-audit:${TAG}"]
  platforms  = ["linux/amd64"]
  provenance = false
  sbom       = false
}

target "svc-notify" {
  context = "../../kelompok5-notification-service"
  tags     = ["${NS}/nexus-svc-notify:${TAG}"]
  platforms  = ["linux/amd64"]
  provenance = false
  sbom       = false
}

target "gateway" {
  context    = "."
  dockerfile = "gateway.Dockerfile"
  tags       = ["${NS}/nexus-gateway:${TAG}"]
  platforms  = ["linux/amd64"]
  provenance = false
  sbom       = false
}
