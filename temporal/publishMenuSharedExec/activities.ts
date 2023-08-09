import { getClient } from '../client'
import { appendStorePublishToQueueSignal, publishMenusFromStoreQueue } from './workflows'
import { PUBLISH_SHARED_EXEC_QUEUE } from '../queues'

async function addMenuPublishToStoreQueue(storeId: string, tempMenuId: string) {
  const client = await getClient()
  await client.workflow.signalWithStart(publishMenusFromStoreQueue, {
    taskQueue: PUBLISH_SHARED_EXEC_QUEUE,
    workflowId: `publishMenusFromStoreQueue:${storeId}`,
    signal: appendStorePublishToQueueSignal,
    signalArgs: [tempMenuId],
    args: [storeId]
  })
}

export default {
  addMenuPublishToStoreQueue
}
