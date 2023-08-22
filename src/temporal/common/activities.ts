import { Writable } from 'node:stream'
import { v4 as uuid } from 'uuid'
import { clone } from 'lodash'

// these are mock implementations for the purposes of this sample project

type MenuContents = {
  products: Product[]
}

type Product = {
  id: string
  name: string
  price: number
}

enum EventType {
  PUBLISHED = 'menu.published'
}

type Event = {
  type: EventType,
  body: any
}

const temporaryMenuStore: Map<string, MenuContents> = new Map()
const permanentMenuStore: Map<string, MenuContents> = new Map()
const activeMenuStore: Map<string, string> = new Map()
let _eventStream: Writable
function getEventStream() {
  if (_eventStream === undefined) _eventStream = new Writable({
    write(_chunk, _encoding, _callback) { _callback() }
  })
  return _eventStream
}

export default {
  // takes a menu identifier, builds a menu, saves the menu to a temporary location, returns temporary menu contents id
  async aggregateMenuContents(_menuId: string): Promise<string> {
    const aggregatedMenu: MenuContents = {
      products: [
        {
          id: uuid(),
          name: 'Pepperoni Pizza',
          price: 1000
        },
        {
          id: uuid(),
          name: 'Supreme Pizza',
          price: 1000
        }
      ]
    }
    const tempMenuId = uuid()

    temporaryMenuStore.set(tempMenuId, aggregatedMenu)

    return tempMenuId
  },

  // take a menu id and return the ids of all stores that serve this menu
  async findStoresUsingMenu(_menuId: string): Promise<string[]> {
    return [uuid(), uuid(), uuid()]
  },

  // take a temporary menu, apply store specific customizations to it,
  async applyMenuCustomizations(baseMenuTempId: string, _storeId: string) {
    const menuContents = clone(temporaryMenuStore.get(baseMenuTempId)!)

    menuContents.products[1].price = 1100

    const customizedMenuId = uuid()
    temporaryMenuStore.set(customizedMenuId, menuContents)

    return customizedMenuId
  },

  async deleteTemporaryMenu(menuId: string) {
    temporaryMenuStore.delete(menuId)
  },

  async saveMenu(temporaryMenuId: string, storeId: string) {
    const menuContents = clone(temporaryMenuStore.get(temporaryMenuId)!)
    const permanentMenuId = uuid()
    permanentMenuStore.set(`${storeId}/${permanentMenuId}`, menuContents)
    return permanentMenuId
  },

  async updateActiveMenu(permanentMenuId: string, storeId: string) {
    activeMenuStore.set(storeId, permanentMenuId)
  },

  async sendPublishedEvent(permanentMenuId: string, storeId: string) {
    const published: Event = {
      type: EventType.PUBLISHED,
      body: {
        storeId,
        menuId: permanentMenuId
      }
    }

    await new Promise((resolve, reject) => {
      try {
        getEventStream().write(JSON.stringify(published), resolve)
      } catch (e) {
        reject(e)
      }
    })
  }
}

