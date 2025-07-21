import { $$, TempBinName, calFlags, mapRev } from '../utils'
import { registerEngine } from '../runner'
import * as core from '@actions/core'
import fs from 'fs'

// const all_files = [
//   'aarch64-linux-musl-cross',
//   'aarch64_be-linux-musl-cross',
//   'arm-linux-musleabi-cross',
//   'arm-linux-musleabihf-cross',
//   'armeb-linux-musleabi-cross',
//   'armeb-linux-musleabihf-cross',
//   'armel-linux-musleabi-cross',
//   'armel-linux-musleabihf-cross',
//   'armv5l-linux-musleabi-cross',
//   'armv5l-linux-musleabihf-cross',
//   'armv6-linux-musleabi-cross',
//   'armv6-linux-musleabihf-cross',
//   'armv7l-linux-musleabihf-cross',
//   'armv7m-linux-musleabi-cross',
//   'armv7r-linux-musleabihf-cross',
//   'i486-linux-musl-cross',
//   'i686-linux-musl-cross',
//   'i686-w64-mingw32-cross',
//   'm68k-linux-musl-cross',
//   'microblaze-linux-musl-cross',
//   'microblazeel-linux-musl-cross',
//   'mips-linux-musl-cross',
//   'mips-linux-musln32sf-cross',
//   'mips-linux-muslsf-cross',
//   'mips64-linux-musl-cross',
//   'mips64-linux-musln32-cross',
//   'mips64-linux-musln32sf-cross',
//   'mips64el-linux-musl-cross',
//   'mips64el-linux-musln32-cross',
//   'mips64el-linux-musln32sf-cross',
//   'mipsel-linux-musl-cross',
//   'mipsel-linux-musln32-cross',
//   'mipsel-linux-musln32sf-cross',
//   'mipsel-linux-muslsf-cross',
//   'or1k-linux-musl-cross',
//   'powerpc-linux-musl-cross',
//   'powerpc-linux-muslsf-cross',
//   'powerpc64-linux-musl-cross',
//   'powerpc64le-linux-musl-cross',
//   'powerpcle-linux-musl-cross',
//   'powerpcle-linux-muslsf-cross',
//   'riscv32-linux-musl-cross',
//   'riscv64-linux-musl-cross',
//   's390x-linux-musl-cross',
//   'sh2-linux-musl-cross',
//   'sh2-linux-muslfdpic-cross',
//   'sh2eb-linux-musl-cross',
//   'sh2eb-linux-muslfdpic-cross',
//   'sh4-linux-musl-cross',
//   'sh4eb-linux-musl-cross',
//   'x86_64-linux-musl-cross',
//   'x86_64-linux-muslx32-cross',
//   'x86_64-w64-mingw32-cross',
//   'loongarch64-linux-musl-cross'
// ]

const val_files = [
  'aarch64-linux-musl-cross',
  'arm-linux-musleabi-cross',
  'arm-linux-musleabihf-cross',
  'armel-linux-musleabi-cross',
  'armel-linux-musleabihf-cross',
  'armv5l-linux-musleabi-cross',
  'armv5l-linux-musleabihf-cross',
  'armv6-linux-musleabi-cross',
  'armv6-linux-musleabihf-cross',
  'armv7l-linux-musleabihf-cross',
  'armv7m-linux-musleabi-cross',
  'armv7r-linux-musleabihf-cross',
  'i486-linux-musl-cross',
  'mips-linux-musl-cross',
  'mips64-linux-musl-cross',
  'mips64el-linux-musl-cross',
  'mipsel-linux-musl-cross',
  'powerpc64le-linux-musl-cross',
  'riscv64-linux-musl-cross',
  's390x-linux-musl-cross',
  'x86_64-linux-musl-cross',
  'loongarch64-linux-musl-cross'
]

const archMap = {
  x86_64: 'amd64',
  aarch64: 'arm64',
  mips64el: 'mips64le',
  mipsel: 'mipsle',
  powerpc64: 'ppc64',
  powerpc64le: 'ppc64le',
  i486: '386',
  loongarch64: 'loong64'
} as Record<string, string>
const archMapRev = mapRev(archMap)

const osMap = {
  w64: 'windows'
} as Record<string, string>
const osMapRev = mapRev(osMap)

function fileToTarget(file: string) {
  const name = file.replace('-cross', '')
  const [arch, os, musl] = name.split('-')
  return `${osMap[os] ?? os}-${archMap[arch] ?? arch}-${musl}`
}

function targetToFile(target: string) {
  const [os, arch, musl] = target.split('-')
  return `${archMapRev[arch] ?? arch}-${osMapRev[os] ?? os}-${musl}-cross`
}

const staticLinkFlags = `--extldflags '-static -fpic'`

function engineGen(files: string[]) {
  registerEngine({
    targets: files.map(fileToTarget),
    async run(input) {
      const base = input.musl_base_url
      const file = targetToFile(input.target)
      const filename = file + '.tgz'
      const url = `${base}/${filename}`
      const isGitHubUrl = base.startsWith('https://github.com')
      const authHeader = isGitHubUrl ? `-H ${String.raw`Authorization: Bearer ${input.github_token}`}` : ''
      await $$`curl -fsSL --retry 3 ${authHeader} -o ${filename} ${url}`
      await $$`sudo tar xf ${filename} --strip-components 1 -C /usr/local`
      fs.rmSync(filename)
      const [os, arch] = input.target.split('-')
      const env = {
        CGO_ENABLED: '1',
        GOOS: os,
        GOARCH: arch,
        CC: file.replace('-cross', '-gcc')
        // GOARM: getArmVersion(arch)
      } as Record<string, string>
      if (file.includes('arm')) {
        env.GOARCH = 'arm'
      }
      if (arch.includes('armv')) {
        env['GOARM'] = arch.split('armv')[1][0]
      }
      core.info(`Building with env:\n${JSON.stringify(env, null, 2)}...`)
      const flags = input.flags
      if (core.getInput('static-link-for-musl') === 'true') {
        core.info('Setting static link for musl...')
        if (flags.flags.includes(staticLinkFlags)) {
          core.info('Already set static link flags.')
        } else {
          const key = '-ldflags'
          if (flags.extra[key]) {
            flags.extra[key].values.push(staticLinkFlags)
          } else {
            flags.extra[key] = {
              values: [staticLinkFlags],
              separator: ' ',
              connector: '=',
              quote: ''
            }
          }
        }
      }
      await input.$({
        env: env
      })`go build -o ${TempBinName} ${calFlags(flags)} ${input.pkgs}`
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

engineGen(val_files)
