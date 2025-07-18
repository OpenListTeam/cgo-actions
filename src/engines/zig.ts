import { registerEngine } from '../runner'
import { $$, calFlags, TempBinName, mapRev, setupMacOSSDK } from '../utils'
import fs from 'fs'
import * as core from '@actions/core'

// See https://ziglang.org/learn/overview/#wide-range-of-targets-supported:~:text=Tier%203%2B%20target.-,Zig%20ships%20with%20libc,-You%20can%20find
const zig_targets = [
  'x86-linux-gnu',
  'x86_64-linux-gnu',
  'arm-linux-gnueabi',
  'arm-linux-gnueabihf',
  'aarch64-linux-gnu',
  'mips-linux-gnueabi',
  'mipsel-linux-gnueabi',
  'mips64-linux-gnuabi64',
  'mips64el-linux-gnuabi64',
  'riscv64-linux-gnu',
  's390x-linux-gnu',
  'loongarch64-linux-gnu',
  'x86-windows-gnu',
  'x86_64-windows-gnu'
]

const archMap = {
  x86_64: 'amd64',
  aarch64: 'arm64',
  arm: 'arm',
  mips64: 'mips64',
  mips: 'mips',
  mips64el: 'mips64le',
  mipsel: 'mipsle',
  riscv64: 'riscv64',
  x86: '386',
  loongarch64: 'loong64'
} as Record<string, string>
const archMapRev = mapRev(archMap)

const osMap = {
  macos: 'darwin'
} as Record<string, string>
const osMapRev = mapRev(osMap)

function zigTargetToCGoTarget(zigt: string) {
  const [arch, os, libc] = zigt.split('-')
  return `${osMap[os] ?? os}-${archMap[arch] ?? arch}-${libc}`
}

function cgoTargetToZigTarget(target: string) {
  const [os, arch, libc] = target.split('-')
  return `${archMapRev[arch] ?? arch}-${osMapRev[os] ?? os}-${libc}`
}

function engineGen(files: string[]) {
  registerEngine({
    targets: files.map(zigTargetToCGoTarget),
    async prepare(input) {
      console.log(input.output)
      if (!fs.existsSync('/usr/local/bin')) {
        fs.mkdirSync('/usr/local/bin', { recursive: true })
      }
      // Register Zig C and C++ compilers
      for (const target of zig_targets) {
        console.log(`Registering Zig compiler for target: ${target}`)
        const zcc = `#!/bin/sh
        zig cc -target ${target} $@
        `
        const zcxx = `#!/bin/sh
        zig c++ -target ${target} $@
        `
        fs.writeFileSync(`/usr/local/bin/${target}-zcc`, zcc)
        fs.writeFileSync(`/usr/local/bin/${target}-z++`, zcxx)
        await $$`chmod +x /usr/local/bin/${target}-zcc /usr/local/bin/${target}-z++`
      }
    },
    async run(input) {
      const zig_target = cgoTargetToZigTarget(input.target)
      const [os, arch] = input.target.split('-')
      const env = {
        CGO_ENABLED: '1',
        GOOS: os,
        GOARCH: arch,
        CC: `/usr/local/bin/${zig_target}-zcc`
      } as Record<string, string>
      const flags = input.flags
      if (os === 'darwin') {
        const sdk = await setupMacOSSDK()
        console.log(`Using macOS SDK at ${sdk.sdk}`)
        const macOSSDKLinkFlags = `--extldflags '-isysroot ${sdk.sdk} -iframework ${sdk.frameworks}'`
        core.info('Setting macOS SDK link flags ...')
        if (flags.flags.includes(macOSSDKLinkFlags)) {
          core.info('Already set  macOS SDK link flags.')
        } else {
          const key = '-ldflags'
          if (flags.extra[key]) {
            flags.extra[key].values.push(macOSSDKLinkFlags)
          } else {
            flags.extra[key] = {
              values: [macOSSDKLinkFlags],
              separator: ' ',
              connector: '=',
              quote: ''
            }
          }
        }
      }
      if (arch === 'arm') {
        env.GOARCH = 'arm'
        env.GOARM = '7'
      }
      if (arch === 'mips' || arch === 'mipsle') {
        env.GOMIPS = 'softfloat'
      }
      if (arch === 'mips64' || arch === 'mips64le') {
        env.GOMIPS64 = 'softfloat'
      }
      core.info(`Building with env:\n${JSON.stringify(env, null, 2)}...`)
      await input.$({
        env: env
      })`go build -o ${os == 'windows' ? TempBinName + '.exe' : TempBinName} ${calFlags(flags)} ${input.pkgs}`
    },
    async on_target_rename(input) {
      const [os, arch, musl] = input.target.split('-')
      let res = core.getInput('musl-target-format')
      res = res.replace('$os', os)
      res = res.replace('$arch', arch)
      res = res.replace('$musl', musl)
      return res
    }
  })
}

engineGen(zig_targets)
