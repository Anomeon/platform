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

export type AsString<T> = string | { __as_string: T }
// export type AsNumber<T> = number | { __as_number: T }

// export type PropertyType = AsNumber<any> | AsString<any> | { [key: string]: PropertyType } | PropertyType[]

/** Function */
export type AnyFunc = (...args: any[]) => any

export type Extension<T> = AsString<T> & { __extension: void }
export type IntlString = AsString<string> & { __intl_string: void }
export type Resource = AsString<string> & { __resource: void }
