# CGO Actions

![CI](https://github.com/OpenListTeam/cgo-actions/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/OpenListTeam/cgo-actions/actions/workflows/check-dist.yml/badge.svg)](https://github.com/OpenListTeam/cgo-actions/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/OpenListTeam/cgo-actions/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/OpenListTeam/cgo-actions/actions/workflows/codeql-analysis.yml)

A github actions to help build your golang program with CGO_ENABLED = 1

## Usage Example

```yaml
name: Build Go Program

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  cgo-action:
    strategy:
      matrix:
        targets:
          - '!(*musl*|*windows-arm64*|*android*|*freebsd*|*windows7*)' # xgo
          - 'linux-*-musl*' #musl
          - 'windows-arm64' #win-arm64
          - 'android-*' #android
          - 'freebsd-*' #freebsd
          - 'windows7-*' #windows7
    name: Build Go Program
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        id: checkout
        uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Build go program
        id: cgo-action
        uses: go-cross/cgo-actions@v1
        with:
          dir: '.'
          targets: ${{ matrix.targets }}

      - name: Print Output
        id: output
        run: echo "${{ steps.cgo-action.outputs.files }}"
```

> [!NOTE]
>
> Of course, you can use the `*` wildcard to match multiple targets, but it will
> take longer to build and may fail due to the space limit of the github
> actions.

## Inputs

| Input                | Description                                     | Required | Default                                                                 |
| -------------------- | ----------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| dir                  | The directory to work                           | No       | .                                                                       |
| packages             | The packages to build                           | No       | .                                                                       |
| flags                | The flags to pass to the go build command       | No       | -ldflags=-w -s                                                          |
| static-link-for-musl | Whether to statically link for the musl libc    | No       | true                                                                    |
| targets              | The targets to build for                        | No       | \*                                                                      |
| out-dir              | The output directory                            | No       | bin                                                                     |
| output               | The output binary name                          | No       | $repo-$target$ext                                                       |
| musl-target-format   | The format of the musl target                   | No       | $os-$arch-$musl                                                         |
| x-flags              | Extra X ldflags to pass to the go build command | No       |                                                                         |
| musl-base-url        | Where to download musl compilers                | No       | https://github.com/OpenListTeam/musl-compilers/releases/latest/download |

### Supported Targets

1. Use glob patterns to match the targets you want to build for.
2. LoongArch64 have 3 different targets, `linux-loong64`, `linux-loong64-abi1.0`
   and `linux-loong64-musl`. Both `linux-loong64` and `linux-loong64-musl`
   targets for `ABI2.0` (a.k.a new world) and `linux-loong64-abi1.0` targets for
   `ABI1.0` (a.k.a old world).

- darwin-amd64
- darwin-arm64
- linux-386
- linux-amd64
- linux-arm-5
- linux-arm-6
- linux-arm-7
- linux-arm64
- linux-mips
- linux-mipsle
- linux-mips64
- linux-mips64le
- linux-ppc64le
- linux-riscv64
- linux-loong64
- linux-loong64-abi1.0
- linux-s390x
- windows-386
- windows-amd64
- linux-arm64-musl
- linux-arm-musleabi
- linux-arm-musleabihf
- linux-armel-musleabi
- linux-armel-musleabihf
- linux-armv5l-musleabi
- linux-armv5l-musleabihf
- linux-armv6-musleabi
- linux-armv6-musleabihf
- linux-armv7l-musleabihf
- linux-armv7m-musleabi
- linux-armv7r-musleabihf
- linux-mips-musl
- linux-mips64-musl
- linux-mips64le-musl
- linux-mipsle-musl
- linux-ppc64le-musl
- linux-riscv64-musl
- linux-s390x-musl
- linux-amd64-musl
- linux-loong64-musl
- windows-arm64
- android-386
- android-amd64
- android-arm64
- android-arm
- freebsd-386
- freebsd-amd64
- freebsd-arm64
- windows7-386
- windows7-amd64

## Outputs

| Output | Description               |
| ------ | ------------------------- |
| files  | The files that were built |
