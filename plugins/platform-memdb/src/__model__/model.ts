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

import core from '.'
import {
  CoreService, Obj, Doc, Class, BagOf, InstanceOf,
  Property, Type, Emb, ResourceProperty, Ref, RefTo
} from '..'

export default (S: CoreService): Doc[] => {
  return [
    S.loadClass<Obj, Obj>({
      _id: core.class.Obj,
      _attributes: {}
    }),

    S.loadClass<Doc, Obj>({
      _id: core.class.Doc,
      _attributes: {
        _id: S.newInstance(core.class.RefTo, {
          to: core.class.Doc,
        }),
        _mixins: S.newInstance(core.class.ArrayOf, {
          of: S.newInstance(core.class.RefTo, { to: core.class.Doc })
        })
      }
    }),

    S.loadClass<Class<Obj>, Doc>({
      _id: core.class.Class,
      _attributes: {
        _attributes: S.newInstance(core.class.BagOf, {
          of: S.newInstance(core.class.InstanceOf, { of: core.class.Type })
        }),
        _extends: S.newInstance(core.class.RefTo as Ref<Class<RefTo<Class<Obj>>>>, {
          to: core.class.Class
        })
      },
    }),

    S.loadClass<Type<any>, Emb>({
      _id: core.class.Type,
      _attributes: {
        default: S.newInstance(core.class.Type, {}),
        exert: S.newInstance(core.class.ResourceType, {
          default: 'func: type.exert' as ResourceProperty<(value: Property<any>) => any>
        })
      }
    }),

    S.loadClass<BagOf<any>, Type<any>>({
      _id: core.class.BagOf,
      _attributes: {
        of: S.newInstance(core.class.InstanceOf as Ref<Class<InstanceOf<Type<any>>>>, {
          of: core.class.Type
        })
      }
    }),

    S.loadClass<InstanceOf<any>, Type<any>>({
      _id: core.class.InstanceOf,
      _attributes: {
        of: S.newInstance(core.class.RefTo as Ref<Class<RefTo<Class<Obj>>>>, {
          to: core.class.Class
        })
      }
    }),

    S.loadClass<RefTo<any>, Type<any>>({
      _id: core.class.RefTo,
      _attributes: {
        to: S.newInstance(core.class.RefTo as Ref<Class<RefTo<Class<Obj>>>>, {
          to: core.class.Class
        })
      }
    })

  ]

}