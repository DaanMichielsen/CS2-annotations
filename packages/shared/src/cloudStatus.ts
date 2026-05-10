export type CloudSyncStatus =
  | 'synced'
  | 'local_ahead'
  | 'cloud_ahead'
  | 'not_in_cloud'
  | 'loading'

export interface GuideSyncState {
  status: CloudSyncStatus
  cloudId?: string
  cloudVersion?: number
}
