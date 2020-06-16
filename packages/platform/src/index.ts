//
// Copyright © 2020 Anticrm Platform Contributors.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

/** 
 * Platform Resource Identifier. 
 * 
 * 'Resource' is simply any JavaScript object. There is a plugin exists, which 'resolve' PRI into actual object.
 * This is a difference from Metadata. Metadata object 'resolved' by Platform instance, so we may consider Metadata as
 * a Resource, provided by Platform itself. Because there is always a plugin, which resolve `Resource` resolution is 
 * aynchronous process.
 * 
 * `Resource` is a string of `kind:plugin.id` format. Since Metadata is a kind of Resource. 
 * Metadata also can be reolved using resource API.
 * 
 * Examples of `Resource`:
 * ```typescript
 *   `class:contact.Person` as Resource<Class<Person>> // database object with id === `class:contact.Person`
 *   `string:class.ClassLabel` as Resource<string> // translated string according to current language and i18n settings
 *   `asset:ui.Icons` as Resource<URL> // URL to SVG sprites
 *   `easyscript:2+2` as Resource<() => number> // function
 * ```
 */
export type Resource<T> = string & { __resource: T }

/**
 * Platform Metadata Identifier (PMI).
 * 
 * 'Metadata' is simply any JavaScript object, which is used to configure platform, e.g. IP addresses.
 * Another example of metadata is an asset URL. The logic behind providing asset URLs as metadata is 
 * we know URL at compile time only and URLs vary depending on deployment options.
 */
export type Metadata<T> = Resource<T> & { __metadata: true }


/** Base interface for every plugin API. */
export interface Service { }
/** Plugin identifier. */
export type Plugin<S extends Service> = Resource<S>
type AnyPlugin = Plugin<Service>

export interface ResourceProvider extends Service {
  resolve (resource: Resource<any>): Promise<any>
}

/**
 * A plugin may request platform to inject resolved references to plugins it depends on.
 */
export interface PluginDependencies { [key: string]: AnyPlugin }

export type InferPlugins<T extends PluginDependencies> = {
  [P in keyof T]: T[P] extends Plugin<infer Service> ? Service : T[P]
}

export interface PluginDescriptor<P extends Service, D extends PluginDependencies> {
  id: Plugin<P>,
  deps: D
}
type AnyDescriptor = PluginDescriptor<Service, PluginDependencies>

type PluginModule<P extends Service, D extends PluginDependencies> = () => Promise<{
  default: (platform: Platform, deps: InferPlugins<D>) => Promise<P>
}>
type AnyModule = PluginModule<Service, PluginDependencies>

/// ///////////

type ExtractType<T, X extends Record<string, Metadata<T>>> = { [P in keyof X]:
  X[P] extends Metadata<infer Z> ? Z : never
}

export enum PluginStatus {
  STOPPED,
  RUNNING,
}

export interface PluginInfo {
  id: AnyPlugin
  version: string,
  status: PluginStatus
}

export type ResourceKind = string & { __resourceKind: true }

export interface ResourceInfo {
  kind: ResourceKind
  plugin: Plugin<Service>
  id: string
}

export function getResourceKind (resource: Resource<any>): ResourceKind {
  return resource.substring(0, resource.indexOf(':')) as ResourceKind
}

/*!
 * Built on Anticrm Platform™
 * Copyright © 2020 Anticrm Platform Contributors. All Rights Reserved.
 * Licensed under the Eclipse Public License, Version 2.0
 */
export class Platform {
  // private COMPRESS_IDS = false

  // compressId(id: string): string {
  //   if (this.COMPRESS_IDS) {
  //     let h = 0
  //     for (let i = 0; i < id.length; i++)
  //       h = Math.imul(17, h) + id.charCodeAt(i) | 0

  //     return Math.abs(h).toString(36)
  //   }
  //   return id
  // }

  // M E T A D A T A

  getMetadata<T> (id: Metadata<T>): T | undefined {
    return this.resources.get(id)
  }

  setMetadata<T> (id: Metadata<T>, value: T): void {
    this.resources.set(id, value)
  }

  loadMetadata<T, X extends Record<string, Metadata<T>>> (ids: X, resources: ExtractType<T, X>) {
    for (const key in ids) {
      const id = ids[key]
      const resource = resources[key]
      if (!resource) {
        throw new Error(`no resource provided, key: ${key}, id: ${id}`)
      }
      this.resources.set(id, resource)
    }
  }

  // R E S O U R C E S

  private resources = new Map<Resource<any>, any>()
  private resolving = new Map<Resource<any>, Promise<any>>()

  private resolvers = new Map<string, Plugin<ResourceProvider>>()
  private resolvedProviders = new Map<string, Promise<ResourceProvider>>()

  /** Peek does not resolve resource. Return resource if it's already loaded. */
  peekResource<T> (resource: Resource<T>): T { return this.resources.get(resource) }

  async getResource<T> (resource: Resource<T>): Promise<T> {
    const resolved = this.resources.get(resource)
    if (resolved) { return resolved }
    else {
      let resolving = this.resolving.get(resource)
      if (resolving) { return resolving }

      console.log('resolve resource: ' + resource)
      resolving = new Promise((resolve, reject) => {
        const info = this.getResourceInfo(resource)
        console.log(`loading '${resource}' from '${info.plugin}'.`)
        this.getPlugin(info.plugin).then(plugin => {
          const value = this.resources.get(resource)
          if (!value) { throw new Error('resource not loaded: ' + resource) }
          resolve(value)
        }).catch(err => { reject(err) })
      })

      this.resolving.set(resource, resolving)
      return resolving
    }
  }

  setResource<T> (resource: Resource<T>, value: T): void {
    this.resources.set(resource, value)
  }

  getResourceInfo (resource: Resource<any>): ResourceInfo {
    const index = resource.indexOf(':')
    const kind = resource.substring(0, index) as ResourceKind
    const dot = resource.indexOf('.', index)
    const plugin = resource.substring(index + 1, dot) as AnyPlugin
    const id = resource.substring(dot)
    return { kind, plugin, id }
  }

  // TODO: do we need the following?

  resolve<T> (resource: Resource<T>): Promise<T> {
    const kind = resource.substring(0, resource.indexOf(':'))
    let provider = this.resolvedProviders.get(kind)
    if (!provider) {
      const resourcePlugin = this.resolvers.get(kind)
      if (!resourcePlugin) {
        return this.getResource(resource)
      } else {
        provider = this.getPlugin(resourcePlugin)
        this.resolvedProviders.set(kind, provider)
      }
    }
    return provider.then(plugin => plugin.resolve(resource))
  }

  setResolver (kind: string, resolver: Plugin<ResourceProvider>) {
    this.resolvers.set(kind, resolver)
  }

  // P L U G I N S

  private plugins = new Map<AnyPlugin, Promise<Service>>()
  private locations = [] as [AnyDescriptor, AnyModule][]

  private getLocation (id: AnyPlugin): [AnyDescriptor, AnyModule] {
    for (const location of this.locations) {
      if (location[0].id === id) { return location }
    }
    throw new Error('no location provided for plugin: ' + id)
  }

  // TODO #3 `PluginModule` type does not check against `PluginDescriptor`
  addLocation<P extends Service, X extends PluginDependencies> (plugin: PluginDescriptor<P, X>, module: PluginModule<P, X>) {
    this.locations.push([plugin, module as any])
  }

  async getPlugin<T extends Service> (id: Plugin<T>): Promise<T> {
    const plugin = this.plugins.get(id)
    if (plugin) {
      return plugin as Promise<T>
    } else {
      const location = this.getLocation(id)
      const plugin = this.resolveDependencies(location[0].deps).then(deps =>
        location[1]().then(module => module.default).then(f => f(this, deps))
      )
      this.plugins.set(id, plugin)
      return plugin as Promise<T>
    }
  }

  getPluginInfos (): PluginInfo[] {
    return this.locations.map(location => {
      const id = location[0].id
      const plugin = this.plugins.get(id)
      const info: PluginInfo = {
        id,
        version: '0.1.0',
        status: plugin ? PluginStatus.RUNNING : PluginStatus.STOPPED
      }
      return info
    })
  }

  // D E P E N D E N C I E S

  async resolveDependencies (deps: PluginDependencies): Promise<{ [key: string]: Service }> {
    const result = {} as { [key: string]: Service }
    for (const key in deps) {
      const id = deps[key]
      result[key] = await this.getPlugin(id)
    }
    return result
  }

}

// I D E N T I T Y

type Namespace = Record<string, Record<string, any>>

function transform<N extends Namespace> (plugin: AnyPlugin, namespaces: N, f: (id: string, value: any) => any): N {
  const result = {} as Namespace
  for (const namespace in namespaces) {
    const extensions = namespaces[namespace]
    const transformed = {} as Record<string, any>
    for (const key in extensions) {
      transformed[key] = f(namespace + ':' + plugin + '.' + key, extensions[key])
    }
    result[namespace] = transformed
  }
  return result as N
}

export function identify<N extends Namespace> (pluginId: AnyPlugin, namespace: N): N {
  return transform(pluginId, namespace, (id: string, value) => value === '' ? id : value)
}

export function plugin<P extends Service, D extends PluginDependencies, N extends Namespace> (id: Plugin<P>, deps: D, namespace: N): PluginDescriptor<P, D> & N {
  return { id, deps, ...identify(id, namespace) }
}

// P R O M I S E

// export function allValues (object: { [key: string]: Promise<any> }): Promise<{ [key: string]: any }> {
//   const keys = Object.keys(object)
//   const values = Object.values(object)
//   const all = Promise.all(values)
//   return all.then(values => {
//     const result = []
//     for (let i = 0; i < keys.length; i++) {
//       result.push([keys[i], values[i]])
//     }
//     return Object.fromEntries(result) as { [key: string]: any }
//   })
// }

// R P C

export interface Request {
  id: string | number | null
  meth: string
  params?: any[]
}

export interface RpcError {
  code: number
  message: string
  data?: any
}

export interface Response {
  id: string | number | null
  result?: any
  error?: RpcError
}

export function makeRequest (request: Request): string {
  return JSON.stringify(request)
}

export function getRequest (req: string): Request {
  return JSON.parse(req as string)
}

export function makeResponse (response: Response): string {
  return JSON.stringify(response)
}

export function getResponse (res: string): Response {
  return JSON.parse(res as string)
}
