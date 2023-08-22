import { ActivityOptions } from '@temporalio/workflow'

export const MAX_WORKFLOW_HISTORY_LENGTH = 2000

export const MAX_WORKFLOW_IDLE_MS = 2 * 1000 * 60 * 60

export const DEFAULT_ACTIVITY_OPTIONS: ActivityOptions = {
  startToCloseTimeout: '10m'
}
