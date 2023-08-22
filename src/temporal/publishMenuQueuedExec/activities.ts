import { getClient } from '../client'
import {
  appendStorePublishToQueueSignal,
  publishMenusFromStoreQueue,
  storePublishInQueueCompleteSignal
} from './workflows'
import { PUBLISH_QUEUED_EXEC_QUEUE } from '../queues'

async function addMenuPublishToStoreQueue(initiatorId: string, storeId: string, tempMenuId: string) {
  const client = await getClient()
  await client.workflow.signalWithStart(publishMenusFromStoreQueue, {
    taskQueue: PUBLISH_QUEUED_EXEC_QUEUE,
    workflowId: `publishMenusFromStoreQueue:${storeId}`,
    signal: appendStorePublishToQueueSignal,
    signalArgs: [{ menuId: tempMenuId, initiatorId  }],
    args: [storeId]
  })
}

async function sendPublishCompleteSignal(workflowId: string, storeId: string) {
  const client = await getClient()
  const handle = client.workflow.getHandle(workflowId)
  await handle.signal(storePublishInQueueCompleteSignal, storeId)
}

export default {
  addMenuPublishToStoreQueue,
  sendPublishCompleteSignal
}
