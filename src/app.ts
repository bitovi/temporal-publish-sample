import { NativeConnection, Worker } from '@temporalio/worker'
import process from 'process'

import commonActivities from './temporal/common/activities'
import queuedSignalActivities from './temporal/publishMenuQueuedSignal/activities'
import queuedExecActivities from './temporal/publishMenuQueuedExec/activities'
import { PUBLISH_QUEUED_EXEC_QUEUE, PUBLISH_QUEUED_SIGNAL_QUEUE } from './temporal/queues'

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: process.env['TEMPORAL_ADDRESS'] })
  const publishMenuLockingWorker = await Worker.create({
    connection,
    activities: {
      ...commonActivities,
      ...queuedSignalActivities
    },
    workflowsPath: require.resolve('./temporal/publishMenuQueuedSignal/workflows'),
    taskQueue: PUBLISH_QUEUED_SIGNAL_QUEUE
  })

  const publishMenuSharedExecWorker = await Worker.create({
    connection,
    activities: {
      ...commonActivities,
      ...queuedExecActivities
    },
    workflowsPath: require.resolve('./temporal/publishMenuQueuedExec/workflows'),
    taskQueue: PUBLISH_QUEUED_EXEC_QUEUE
  })

  await Promise.all([
    publishMenuLockingWorker.run(),
    publishMenuSharedExecWorker.run()
  ])
}

run().catch((err) => {
  console.error(err.toString())
  process.exit(1)
})
