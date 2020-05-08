//
// Copyright © 2020 Andrey Platov <andrey.v.platov@gmail.com>
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

import { Platform, Metadata } from '@anticrm/platform'
import { CorePlugin, Query, pluginId } from '.'
import core, {
  Obj, Doc, Ref, Bag, Class, Type, RefTo, Embedded,
  PropertyType, BagOf, InstanceOf, ArrayOf, Container, Session, Content
} from '.'
import { TSession, SessionProto, Konstructor } from './session'

//////////

class TCorePlugin implements CorePlugin {

  readonly platform: Platform
  readonly pluginId = pluginId

  constructor(platform: Platform) {
    this.platform = platform
  }

  newSession(): Session { return new TSession(this.platform) }
}

export default (platform: Platform): CorePlugin => {

  class TSessionProto implements SessionProto {
    getSession(): TSession { throw new Error('session provide the implementation') }
    __mapKey(_class: Ref<Class<Obj>>, key: string): string | null { return null }
  }

  class TEmbedded extends TSessionProto implements Embedded {
    _class!: Ref<Class<this>>
    toIntlString(plural?: number): string { return this.getClass().toIntlString(plural) }
    getClass(): Class<this> {
      return this.getSession().getInstance(this._class, core.class.Struct as Ref<Class<Class<this>>>)
    }

    __mapKey(_class: Ref<Class<Obj>>, key: string) { return key }
  }

  class TDoc extends TSessionProto implements Doc {
    _class!: Ref<Class<this>>
    _id!: Ref<this>
    toIntlString(plural?: number): string { return this.getClass().toIntlString(plural) }
    getClass(): Class<this> {
      return this.getSession().getInstance(this._class, core.class.Document as Ref<Class<Class<this>>>)
    }

    __mapKey(_class: Ref<Class<Obj>>, key: string) { return key.startsWith('_') ? key : _class + ':' + key }
  }

  // T Y P E S 

  class TType<T extends PropertyType> extends TEmbedded implements Type<T> {
    _default?: T
    exert(value: T, target?: PropertyType, key?: PropertyKey): any { return value ?? this._default }
    hibernate(value: any): T { return value }
  }

  class TInstanceOf<T extends Embedded> extends TType<T> {
    of!: Ref<Class<T>>
    exert(value: T) {
      // console.log('instanceof instantiating: ')
      // console.log(value)
      return this.getSession().instantiate(value._class, value)
    }
  }

  // C O L L E C T I O N S : A R R A Y

  class ArrayProxyHandler implements ProxyHandler<PropertyType[]> {
    private type: Type<PropertyType>

    constructor(type: Type<PropertyType>) {
      this.type = type
    }

    get(target: PropertyType[], key: PropertyKey): any {
      const value = Reflect.get(target, key)
      return this.type.exert(value)
    }
  }

  class TArrayOf<T extends PropertyType> extends TType<T[]> {
    of!: Type<T>
    exert(value: T[]) {
      return new Proxy(value, new ArrayProxyHandler(this.of))
    }
  }

  // C O L L E C T I O N S : B A G

  class BagProxyHandler implements ProxyHandler<Bag<PropertyType>> {
    private type: Type<PropertyType>

    constructor(type: Type<PropertyType>) {
      this.type = type
    }

    get(target: Bag<PropertyType>, key: string): any {
      const value = Reflect.get(target, key)
      return this.type.exert(value)
    }
  }

  class TBagOf<T extends PropertyType> extends TType<Bag<T>> implements BagOf<T> {
    of!: Type<T>
    exert(value: Bag<T>) {
      return new Proxy(value, new BagProxyHandler(this.of))
    }
  }

  // S T R U C T U R A L  F E A T U R E S

  class Struct<T extends Obj> extends TDoc implements Class<T> {
    _attributes!: Bag<Type<PropertyType>>
    _extends?: Ref<Class<Obj>>
    _native?: Metadata<T>

    toIntlString(plural?: number): string { return 'struct: ' + this._id }

    createConstructor(): Konstructor<T> {
      const session = this.getSession()
      const _class = this._id
      return data => {
        const instance = session.instantiate(_class, data)
        Object.assign(instance, data)
        return instance as T
      }
    }

    newInstance(data: Content<T>): T {
      const session = this.getSession()
      let ctor = session.constructors.get(this._id) as Konstructor<T>
      if (!ctor) {
        ctor = this.createConstructor()
        session.constructors.set(this._id, ctor)
      }
      return ctor(data)
    }
  }

  class Document<T extends Doc> extends TDoc implements Class<T> {
    _attributes!: Bag<Type<PropertyType>>
    _extends?: Ref<Class<Obj>>
    _native?: Metadata<T>

    toIntlString(plural?: number): string { return 'doc: ' + this._id }

    createConstructor(): Konstructor<T> {
      const session = this.getSession()
      const _class = this._id
      return data => {
        const _id = (data as Content<Doc>)._id
        const container = session.getContainer(_id, true)
        container._classes.push(_class)
        const instance = session.instantiate(_class, container)
        Object.assign(instance, data)
        return instance as T
      }
    }

    newInstance(data: Content<T>): T {
      const session = this.getSession()
      let ctor = session.constructors.get(this._id)
      if (!ctor) {
        ctor = this.createConstructor()
        session.constructors.set(this._id, ctor)
      }
      return ctor(data) as T
    }
  }

  platform.setMetadata(core.native.Embedded, TEmbedded.prototype)
  platform.setMetadata(core.native.Doc, TDoc.prototype)

  platform.setMetadata(core.native.Type, TType.prototype)
  platform.setMetadata(core.native.BagOf, TBagOf.prototype)
  platform.setMetadata(core.native.ArrayOf, TArrayOf.prototype)
  platform.setMetadata(core.native.InstanceOf, TInstanceOf.prototype)

  platform.setMetadata(core.native.Document, Document.prototype)
  platform.setMetadata(core.native.Struct, Struct.prototype)

  return new TCorePlugin(platform)
}
