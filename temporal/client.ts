import { Client, Connection } from '@temporalio/client'
import process from 'process'

let clientConnection: Connection
let client: Client

async function getClientConnection() {
  if (clientConnection) return clientConnection

  clientConnection = await Connection.connect({ address: process.env['TEMPORAL_ADDRESS'] })
  return clientConnection
}

export async function getClient() {
  if (client) return client

  return new Client({
    connection: await getClientConnection(),
    namespace: process.env['TEMPORAL_NAMESPACE'] ?? 'default'
  })
}
