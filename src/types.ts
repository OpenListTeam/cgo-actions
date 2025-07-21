import { $$ } from './utils'
export { Context } from '@actions/github/lib/context'

export type Flags = {
  flags: string
  extra: {
    [key: string]: {
      values: string[]
      separator?: string // separate if undefined
      connector: '=' | ' '
      quote: "'" | '"' | ''
    }
  }
}

export type CommonInput = {
  dir: string
  pkgs: string
  out_dir: string
  output: string
  musl_base_url: string
  github_token: string
  $: typeof $$
}

export type CommonInputWithTarget = CommonInput & {
  target: string
}

export type Input = CommonInputWithTarget & {
  flags: Flags
}

export type Engine = {
  targets: string[]
  prepare?(input: Input): Promise<void>
  run(input: Input): Promise<string | void>
  on_target_rename?(input: Input): Promise<string>
}
