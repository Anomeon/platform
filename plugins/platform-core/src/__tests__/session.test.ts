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

import { Platform } from '@anticrm/platform'
import { Ref, Class, Doc, ArrayOf } from '@anticrm/platform-core'

import core from '../__model__/id'
import coreModel, { createClass, newContainer, array, str } from '../__model__'
import startCorePlugin from '../plugin'

interface SimpleClass extends Doc {
  s: string
}

const simpleClassId = 'test.simpleClass' as Ref<Class<SimpleClass>>
const simpleClass = createClass(simpleClassId, core.class.Doc, {
  s: str(),
})

interface MyClass extends Doc {
  arrayOfStrings: string[]
}

const myClassId = 'test.myClass' as Ref<Class<MyClass>>
const myClass = createClass(myClassId, core.class.Doc, {
  arrayOfStrings: array(str()),
})

const myClassInstanceId = 'test.myClass.instance' as Ref<MyClass>
const myClassInstance = newContainer(myClassId, {
  _id: myClassInstanceId,
  arrayOfStrings: ['hey', 'there'],
})

const myModel = [simpleClass, myClass, myClassInstance]

describe('session', () => {

  const platform = new Platform()
  const corePlugin = startCorePlugin(platform)
  const session = corePlugin.newSession()
  session.loadModel(coreModel.model)

  it('should get prototype', () => {
    const objectProto = (session as any).getPrototype(core.class.Doc)
    expect(objectProto).toBeDefined()

    const baseProto = Object.getPrototypeOf(objectProto)
    expect(baseProto.hasOwnProperty('getSession')).toBe(true)
    expect(baseProto.getSession() === session).toBe(true)

    // expect(objectProto.hasOwnProperty('_class')).toBe(true)
    expect(objectProto.hasOwnProperty('getSession')).toBe(false)
    expect(objectProto.hasOwnProperty('toIntlString')).toBe(true)
    expect(objectProto.hasOwnProperty('getClass')).toBe(true)
    expect(typeof objectProto.toIntlString).toBe('function')
  })

  it('should get instances', () => {
    const objectClass = session.getInstance(core.class.Emb, core.class.Class)
    expect(typeof objectClass.getSession).toBe('function')
    expect(objectClass.getSession() === session).toBe(true)

    expect(objectClass._id).toBe(core.class.Emb)
    expect(objectClass._native).toBe(core.native.Emb)
    expect(objectClass.getClass()._id).toBe(core.class.Class)
    expect(objectClass.toIntlString()).toBe('doc: core.class.Emb')

    const classClass = session.getInstance(core.class.Class, core.class.Class)
    expect(classClass._extends).toBe(core.class.Doc)
    expect(classClass.toIntlString()).toBe('doc: core.class.Class')

    expect(classClass._attributes._extends._class).toBe(core.class.RefTo)
    const refTo = classClass._attributes._extends.getClass()
    expect(refTo._class).toBe(core.class.Struct)
  })

  it('should create instance', () => {
    session.loadModel(myModel)
    const simpleClass = session.getClass(simpleClassId)
    const s = simpleClass.newInstance({
      _id: 'xxx' as Ref<SimpleClass>,
      s: 'hey there'
    })
    expect(s._id).toBe('xxx')
    expect(s._class).toBe(simpleClassId)
    expect(s.s).toBe('hey there')
  })

  it('should create class', () => {
    interface X extends Doc {
      x: string
    }
    const xClass = session.createClass('x.class' as Ref<Class<X>>, core.class.Doc, {
      x: str()
    })
    expect(xClass._id).toBe('x.class')
  })

  // it('should work with arrays', () => {
  //   session.loadModel(myModel)
  //   const myInstance = session.getInstance(myClassInstanceId)
  //   expect(myInstance._id).toBe(myClassInstanceId)
  //   expect(myInstance.arrayOfStrings[0]).toBe('hey')
  //   expect(myInstance.arrayOfStrings[1]).toBe('there')
  // })

  // it('should work with mixins', () => {
  //   const myInstance = session.getInstance(myClassInstanceId)
  //   console.log(myInstance.mixins[0])
  // })

})