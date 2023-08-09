import { PUBLISH_LOCKING_QUEUE } from '../queues'
import { workflowInfo } from '@temporalio/workflow'
import { lock, lockRequestSignal } from './workflows'
import { getClient } from '../client'

export default {
  async sendLockRequestSignal(resourceId: string) {
    const client = await getClient()
    await client.workflow.signalWithStart(lock, {
      taskQueue: PUBLISH_LOCKING_QUEUE,
      workflowId: `lock:${resourceId}`,
      signal: lockRequestSignal,
      args: [],
      signalArgs: [{
        initiatorId: workflowInfo().workflowId,
        timeoutMs: 24 * 60 * 60 * 1000 // 1 day
      }]
    })
  },
  async sendLockReleaseSignal(resourceId: string, releaseSignal: string) {
    const client = await getClient()
    const handle = client.workflow.getHandle(`lock:${resourceId}`)
    await handle.signal(releaseSignal)
  }
}
