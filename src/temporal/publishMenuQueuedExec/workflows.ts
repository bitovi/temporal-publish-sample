import { condition, continueAsNew, defineSignal, proxyActivities, setHandler, workflowInfo } from '@temporalio/workflow'
import type CommonPublishActivities from '../common/activities'
import type PublishMenuQueuedExecActivities from './activities'
import { DEFAULT_ACTIVITY_OPTIONS, MAX_WORKFLOW_HISTORY_LENGTH, MAX_WORKFLOW_IDLE_MS } from '../config'

type AppendStorePublishToQueueSignalArguments = [{ menuId: string, initiatorId: string }]
export const appendStorePublishToQueueSignal = defineSignal<AppendStorePublishToQueueSignalArguments>('appendStorePublishToQueue')

type StorePublishInQueueCompleteSignalArguments = [string]
export const storePublishInQueueCompleteSignal = defineSignal<StorePublishInQueueCompleteSignalArguments>('storePublishInQueueComplete')

const {
  aggregateMenuContents,
  applyMenuCustomizations,
  deleteTemporaryMenu,
  findStoresUsingMenu,
  updateActiveMenu,
  saveMenu,
  sendPublishedEvent
} = proxyActivities<typeof CommonPublishActivities>(DEFAULT_ACTIVITY_OPTIONS)
const { addMenuPublishToStoreQueue, sendPublishCompleteSignal } = proxyActivities<typeof PublishMenuQueuedExecActivities>(DEFAULT_ACTIVITY_OPTIONS)

export async function publishMenusFromStoreQueue(storeId: string, publishQueue: AppendStorePublishToQueueSignalArguments[0][] = []) {
  setHandler(appendStorePublishToQueueSignal, (publishSignal) => { publishQueue.push(publishSignal) })

  while (workflowInfo().historyLength < MAX_WORKFLOW_HISTORY_LENGTH) {
    await condition(() => publishQueue.length > 0, MAX_WORKFLOW_IDLE_MS)
    if (publishQueue.length === 0) break // is hit if the timeout above is exceeded rather than a new request arriving
    const { menuId, initiatorId } = publishQueue.shift()!

    try {
      const customizedMenuId = await applyMenuCustomizations(menuId, storeId)
      const permanentMenuId = await saveMenu(customizedMenuId, storeId)
      await updateActiveMenu(permanentMenuId, storeId)
      await sendPublishedEvent(permanentMenuId, storeId)
      await deleteTemporaryMenu(customizedMenuId)
    }
    finally {
      await sendPublishCompleteSignal(initiatorId, storeId)
    }
  }

  // carry over any pending menu ids in the queue to the next execution
  if (publishQueue.length > 0) {
    await continueAsNew<typeof publishMenusFromStoreQueue>(storeId, publishQueue)
  }
}

export async function publishMenuWithQueuedExec(menuId: string) {
  const [tempMenuId, stores] = await Promise.all([
    aggregateMenuContents(menuId),
    findStoresUsingMenu(menuId)
  ])
  const remainingStores = new Set(stores)
  const workflowId = workflowInfo().workflowId

  // send a signal to all the per-store shared executions that this menu should be published to the store
  await Promise.all(stores.map((storeId) => addMenuPublishToStoreQueue(workflowId, storeId, tempMenuId)))

  setHandler(storePublishInQueueCompleteSignal, (storeId) => { remainingStores.delete(storeId) })

  // await all signals from the per-store shared executions that they have finished publishing
  await condition(() => remainingStores.size === 0)
  deleteTemporaryMenu(tempMenuId)
}
