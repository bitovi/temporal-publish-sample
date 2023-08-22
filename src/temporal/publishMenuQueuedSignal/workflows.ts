import {
  condition,
  continueAsNew,
  defineSignal,
  getExternalWorkflowHandle,
  setHandler,
  workflowInfo,
  uuid4,
  proxyActivities,
  executeChild
} from '@temporalio/workflow'
import { DEFAULT_ACTIVITY_OPTIONS, MAX_WORKFLOW_HISTORY_LENGTH, MAX_WORKFLOW_IDLE_MS } from '../config'
import type CommonPublishActivities from '../common/activities'
import type PublishMenuQueuedSignalActivities from './activities'
import { PUBLISH_QUEUED_SIGNAL_QUEUE } from '../queues'

export type LockRequest = {
  initiatorId: string
  timeoutMs: number
}
export type LockAcquired =  {
  releaseSignalName: string
}

export const lockRequestSignal = defineSignal<[LockRequest]>('lock-requested')
export const lockAcquiredSignal = defineSignal<[LockAcquired]>('lock-acquired')

const {
  aggregateMenuContents,
  applyMenuCustomizations,
  deleteTemporaryMenu,
  findStoresUsingMenu,
  updateActiveMenu,
  saveMenu,
  sendPublishedEvent
} = proxyActivities<typeof CommonPublishActivities>(DEFAULT_ACTIVITY_OPTIONS)

const {
  sendLockRequestSignal,
  sendLockReleaseSignal
} = proxyActivities<typeof PublishMenuQueuedSignalActivities>(DEFAULT_ACTIVITY_OPTIONS)

export async function lock(requests: LockRequest[] = []): Promise<void> {
  setHandler(lockRequestSignal, (req) => { requests.push(req) })

  while (workflowInfo().historyLength < MAX_WORKFLOW_HISTORY_LENGTH) {
    await condition(() => requests.length > 0, MAX_WORKFLOW_IDLE_MS)
    if (requests.length === 0) break // is hit if the timeout above is exceeded rather than a new request arriving

    const req = requests.shift()!
    const workflowRequestingLock = getExternalWorkflowHandle(req.initiatorId)
    const releaseSignalName = uuid4()

    // Send a unique secret `releaseSignalName` to the Workflow that acquired the lock. The acquiring Workflow should
    // send a signal with that unique value to release the lock.
    await workflowRequestingLock.signal(lockAcquiredSignal, { releaseSignalName })
    let released = false

    setHandler(defineSignal(releaseSignalName), () => { released = true })

    // The lock is automatically released after `req.timeoutMs`, unless the
    // acquiring Workflow released it. This is to prevent deadlock.
    await condition(() => released, req.timeoutMs)
  }

  // carry over any pending requests to the next execution
  if (requests.length > 0) {
    await continueAsNew<typeof lock>(requests)
  }
}

export async function publishMenuToStore(menuId: string, storeId: string) {
  const resourceId = `${storeId}:publish`
  const workflowId = workflowInfo().workflowId
  let lockReleaseSignal: string | undefined

  setHandler(lockAcquiredSignal, ({ releaseSignalName }) => { lockReleaseSignal = releaseSignalName})
  await sendLockRequestSignal(workflowId, resourceId)

  // wait for the lock to be acquired[
  await condition(() => lockReleaseSignal !== undefined)

  try {
    const customizedMenuId = await applyMenuCustomizations(menuId, storeId)
    const permanentMenuId = await saveMenu(customizedMenuId, storeId)
    await updateActiveMenu(permanentMenuId, storeId)
    await sendPublishedEvent(permanentMenuId, storeId)
    await deleteTemporaryMenu(customizedMenuId)
    return
  } finally {
    await sendLockReleaseSignal(resourceId, lockReleaseSignal!)
  }
}

export async function publishMenuWithQueuedSignal(menuId: string) {
  const [tempMenuId, stores] = await Promise.all([
    aggregateMenuContents(menuId),
    findStoresUsingMenu(menuId)
  ])
  const idSalt = Array.from(Array(5), () => Math.floor(Math.random() * 36).toString(36)).join('');
  await Promise.all(stores.map((storeId) => executeChild(publishMenuToStore, {
    taskQueue: PUBLISH_QUEUED_SIGNAL_QUEUE,
    workflowId: `publishMenuToStore:${menuId}:${storeId}:${idSalt}`,
    args: [tempMenuId, storeId]
  })))
  await deleteTemporaryMenu(tempMenuId)
}
