import { $$, calFlags, TempBinName } from '../utils'
import { registerEngine } from '../runner'
import { $ } from 'execa'
import { Input } from '../types'

const cwd = process.cwd()

async function getGoVersion() {
  const goVersion = await $`go version`
  // go version go1.24.1 darwin/arm64
  const match = goVersion.stdout.match(/go(\d+\.\d+\.\d+)/)
  if (!match) {
    throw new Error('Failed to get go version')
  }
  return match[1]
}

async function setupABI1_0Go() {
  const goVersion = await getGoVersion()
  // Get major and minor version
  const majorMinorVersion =
    goVersion.split('.')[0] + '.' + goVersion.split('.')[1]
  // https://ftp.loongnix.cn/toolchain/golang/go-1.24/abi1.0/go1.24.3.linux-amd64.tar.gz
  await $$`curl -A ${String.raw`"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"`} -fsSL --retry 3 https://ftp.loongnix.cn/toolchain/golang/go-${majorMinorVersion}/abi1.0/go${goVersion}.linux-amd64.tar.gz -o go-loong64-abi1.0.tar.gz`
  await $$`rm -rf go-loong64-abi1.0`
  await $$`mkdir go-loong64-abi1.0`
  await $$`tar -xzf go-loong64-abi1.0.tar.gz -C go-loong64-abi1.0 --strip-components=1`
  await $$`rm go-loong64-abi1.0.tar.gz`
  return `${cwd}/go-loong64-abi1.0/bin/go`
}

async function setupABI1_0GCC() {
  await $$`curl -A ${String.raw`"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"`} -fsSL --retry 3 https://ftp.loongnix.cn/toolchain/gcc/release/loongarch/gcc8/loongson-gnu-toolchain-8.3-x86_64-loongarch64-linux-gnu-rc1.6.tar.xz -o gcc8-loong64-abi1.0.tar.xz`
  await $$`rm -rf gcc8-loong64-abi1.0`
  await $$`mkdir gcc8-loong64-abi1.0`
  await $$`tar -Jxf gcc8-loong64-abi1.0.tar.xz -C gcc8-loong64-abi1.0 --strip-components=1`
  await $$`rm gcc8-loong64-abi1.0.tar.xz`
  return `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-`
}

async function setupABI2_0GCC(input: Input) {
  const github_auth =
    input.github_token != undefined
      ? String.raw`--header "Authorization: Bearer ${input.github_token}"`
      : ''
  await $$`curl -fsSL --retry 3 ${github_auth} https://github.com/loong64/cross-tools/releases/download/20250507/x86_64-cross-tools-loongarch64-unknown-linux-gnu-legacy.tar.xz -o gcc12-loong64-abi2.0.tar.xz`
  await $$`rm -rf gcc12-loong64-abi2.0`
  await $$`mkdir gcc12-loong64-abi2.0`
  await $$`tar -Jxf gcc12-loong64-abi2.0.tar.xz -C gcc12-loong64-abi2.0 --strip-components=1`
  await $$`rm gcc12-loong64-abi2.0.tar.xz`
  return `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-`
}

registerEngine({
  targets: ['linux-loong64', 'linux-loong64-abi1.0'],
  async prepare(input) {
    await setupABI1_0GCC()
    await setupABI2_0GCC(input)
    await setupABI1_0Go()
  },
  async run(input) {
    const target = input.target
    const os = target.split('-')[0]
    const arch = target.split('-')[1]
    const abi = target.split('-')[2] ?? 'abi2.0'
    if (abi === 'abi1.0') {
      await input.$({
        env: {
          CGO_ENABLED: '1',
          GOOS: os,
          GOARCH: arch,
          CC: `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-gcc`,
          CXX: `${cwd}/gcc8-loong64-abi1.0/bin/loongarch64-linux-gnu-g++`
        }
      })`${cwd}/go-loong64-abi1.0/bin/go build -o ${TempBinName} ${calFlags(input.flags)} ${input.pkgs}`
    } else {
      await input.$({
        env: {
          CGO_ENABLED: '1',
          GOOS: os,
          GOARCH: arch,
          CC: `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-gcc`,
          CXX: `${cwd}/gcc12-loong64-abi2.0/bin/loongarch64-unknown-linux-gnu-g++`
        }
      })`go build -o ${TempBinName} ${calFlags(input.flags)} ${input.pkgs}`
    }
  }
})
