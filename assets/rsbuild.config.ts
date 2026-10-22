import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'
import { pluginGenerateEntrypoints, pluginWriteBuildId } from '@pimcore/studio-ui-bundle/rsbuild/plugins'
import { createDynamicRemote } from '@pimcore/studio-ui-bundle/rsbuild/utils'
import { getBuildGroupId } from '@pimcore/studio-ui-bundle/bundler/build-id'
import path from 'path'
import fs from 'fs'
import packages from './package.json'

// Content-derived id for this assets tree. The output lives outside of this directory
// (../public/build/<buildId>), so a build does not change the id of the next one.
const buildId = getBuildGroupId(__dirname)
const buildRoot = path.resolve(__dirname, '..', 'public', 'build')
const buildPath = path.resolve(buildRoot, buildId)

// Drop stale build dirs: only the current build must be picked up by the WebpackEntryPointProvider.
if (fs.existsSync(buildRoot)) {
  fs.readdirSync(buildRoot, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && entry.name !== buildId) {
      fs.rmSync(path.resolve(buildRoot, entry.name), { recursive: true, force: true })
    }
  })
}

if (!fs.existsSync(buildPath)) {
  fs.mkdirSync(buildPath, { recursive: true })
}

const nodeEnv = process.env.NODE_ENV
let env: 'development' | 'production' = 'production'

const isDevServer = nodeEnv === 'dev-server'
if (nodeEnv !== env) {
  env = 'development'
}

export default defineConfig({
  mode: env,
  server: {
    port: 3033
  },
  dev: {
    ...(!isDevServer ? { assetPrefix: '/bundles/formbuilder/build/' + buildId } : {}),
    client: {
      host: 'localhost',
      port: 3033,
      protocol: 'ws'
    }
  },
  source: {
    entry: {
      main: './js/src/main.ts'
    },
    decorators: {
      version: 'legacy'
    }
  },
  output: {
    manifest: true,
    assetPrefix: '/bundles/formbuilder/build/' + buildId,
    distPath: {
      root: buildPath
    }
  },
  tools: {
    bundlerChain: (chain) => {
      chain.output.uniqueName('formbuilder_studio_ui')
    }
  },
  plugins: [
    pluginWriteBuildId({ buildId }),
    pluginGenerateEntrypoints(),
    pluginReact(),
    pluginModuleFederation({
      name: 'formbuilder_studio_ui',
      filename: 'static/js/remoteEntry.js',
      exposes: {
        '.': './js/src/plugins.ts'
      },
      dts: false,
      remotes: {
        '@pimcore/studio-ui-bundle': createDynamicRemote('pimcore_studio_ui_bundle')
      },
      shared: {
        ...packages.dependencies,
        antd: {
          singleton: true,
          eager: true,
          requiredVersion: false
        },
        react: {
          singleton: true,
          eager: true,
          requiredVersion: false
        },
        'react-dom': {
          singleton: true,
          eager: true,
          requiredVersion: false
        }
      }
    })
  ]
})
