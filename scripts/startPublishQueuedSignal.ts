import { v4 as uuidv4 } from 'uuid'
import { Connection, Client } from '@temporalio/client'
import { publishMenuWithQueuedSignal } from '../src/temporal/workflows'
import { PUBLISH_QUEUED_SIGNAL_QUEUE } from '../src/temporal/queues'

async function run() {
  const connection = await Connection.connect({ address: 'localhost:7233' })
  const client = new Client({
    connection,
    namespace: 'default'
  })

  const result = await client.workflow.execute(publishMenuWithQueuedSignal, {
    args: [uuidv4()],
    taskQueue: PUBLISH_QUEUED_SIGNAL_QUEUE,
    workflowId: `publish:${uuidv4()}`
  })

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result))
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
