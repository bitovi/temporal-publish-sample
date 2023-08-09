import process from 'process'

export const MAX_WORKFLOW_HISTORY_LENGTH = process.env['TEMPORAL_MAX_WORKFLOW_HISTORY_LENGTH']
  ? parseInt(process.env['TEMPORAL_MAX_WORKFLOW_HISTORY_LENGTH'], 10)
  : 2000
export const MAX_WORKFLOW_IDLE_MS = process.env['TEMPORAL_MAX_WORKFLOW_IDLE_MS']
  ? parseInt(process.env['TEMPORAL_MAX_WORKFLOW_IDLE_MS'], 10)
  : 2 * 1000 * 60 * 60
