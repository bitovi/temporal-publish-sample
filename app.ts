import { NativeConnection, Worker } from '@temporalio/worker'
import process from 'process'

import * as lockingActivities from './temporal/publishMenuLocking/activities'
import * as sharedExecActivities from './temporal/publishMenuSharedExec/activities'
import { PUBLISH_LOCKING_QUEUE, PUBLISHS_SHARED_EXEC_QUEUE } from './temporal/queues'

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: process.env['TEMPORAL_ADDRESS'] })
  const publishMenuLockingWorker = await Worker.create({
    connection,
    activities: lockingActivities,
    workflowsPath: require.resolve('./temporal/publishMenuLocking/workflows.ts'),
    taskQueue: PUBLISH_LOCKING_QUEUE
  })

  const publishMenuSharedExecWorker = await Worker.create({
    connection,
    activities: sharedExecActivities,
    workflowsPath: require.resolve('./temporal/publishMenuSharedExec/workflows.ts'),
    taskQueue: PUBLISHS_SHARED_EXEC_QUEUE
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
