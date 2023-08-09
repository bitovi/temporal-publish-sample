import { condition, continueAsNew, defineSignal, proxyActivities, setHandler, workflowInfo } from '@temporalio/workflow'
import type CommonPublishActivities from '../common/activities'
import type PublishMenuSharedExecActivities from './activities'
import { MAX_WORKFLOW_HISTORY_LENGTH, MAX_WORKFLOW_IDLE_MS } from '../config'

type AppendStorePublishToQueueSignalArguments = [string]
export const appendStorePublishToQueueSignal = defineSignal<AppendStorePublishToQueueSignalArguments>('appendStorePublishToQueue')

type StorePublishInQueueCompleteSignalArguments = [string]
const storePublishInQueueCompleteSignal = defineSignal<StorePublishInQueueCompleteSignalArguments>('storePublishInQueueComplete')

const {
  aggregateMenuContents,
  applyMenuCustomizations,
  deleteTemporaryMenu,
  findStoresUsingMenu,
  updateActiveMenu,
  saveMenu,
  sendPublishedEvent
} = proxyActivities<typeof CommonPublishActivities>({})
const { addMenuPublishToStoreQueue } = proxyActivities<typeof PublishMenuSharedExecActivities>({})

export async function publishMenusFromStoreQueue(storeId: string, menuQueue: string[] = []) {
  setHandler(appendStorePublishToQueueSignal, (menuId) => { menuQueue.push(menuId) })

  while (workflowInfo().historyLength < MAX_WORKFLOW_HISTORY_LENGTH) {
    await condition(() => menuQueue.length > 0, MAX_WORKFLOW_IDLE_MS)
    if (menuQueue.length === 0) break // is hit if the timeout above is exceeded rather than a new request arriving

    const menuId = menuQueue.shift()!
    const customizedMenuId = await applyMenuCustomizations(menuId, storeId)
    // todo: model checkpoint?
    const permanentMenuId = await saveMenu(customizedMenuId, storeId)
    await updateActiveMenu(permanentMenuId, storeId)
    await sendPublishedEvent(permanentMenuId, storeId)
    await deleteTemporaryMenu(customizedMenuId)
  }

  // carry over any pending menu ids in the queue to the next execution
  if (menuQueue.length > 0) {
    await continueAsNew<typeof publishMenusFromStoreQueue>(storeId, menuQueue)
  }
}

export async function publishMenuWithSharedExec(menuId: string) {
  const [tempMenuId, stores] = await Promise.all([
    aggregateMenuContents(menuId),
    findStoresUsingMenu(menuId)
  ])
  const remainingStores = new Set(stores)

  // send a signal to all the per-store shared executions that this menu should be published to the store
  await Promise.all(stores.map((storeId) => addMenuPublishToStoreQueue(storeId, tempMenuId)))

  setHandler(storePublishInQueueCompleteSignal, (storeId) => { remainingStores.delete(storeId) })

  // await all signals from the per-store shared executions that they have finished publishing
  await condition(() => remainingStores.size === 0)
  deleteTemporaryMenu(tempMenuId)
}
