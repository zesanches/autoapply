import type { ApiSuccessResponse, PaginationMeta, ApplicationStatus, Platform } from '@autoapply/shared'
import { api } from './client'

export interface DashboardStats {
  totalApplications: number
  submitted: number
  failed: number
  pending: number
  creditsAvailable: number
  creditsUsed: number
}

export interface JobListing {
  id: string
  externalId: string
  platform: Platform
  title: string
  company: string
  location: string | null
  remote: boolean
  description: string | null
  url: string
  postedAt: string | null
  createdAt: string
}

export interface Application {
  id: string
  status: ApplicationStatus
  jobId: string
  createdAt: string
  updatedAt: string
  job: {
    title: string
    company: string
    platform: Platform
    url: string
  }
}

export interface UserProfile {
  id: string
  userId: string
  fullName: string
  phone: string | null
  location: string | null
  linkedinUrl: string | null
  resumeUrl: string | null
  resumeData: unknown | null
  skills: string[]
  isComplete: boolean
}

export interface JobSearchParams {
  q: string
  platform: Platform
  location?: string
  remote?: boolean
  page?: number
}

export const dashboardApi = {
  getStats: () =>
    api.get('dashboard/stats').json<ApiSuccessResponse<DashboardStats>>(),
}

export const profileApi = {
  get: () =>
    api.get('profile').json<ApiSuccessResponse<UserProfile>>(),

  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('profile/resume', { body: form }).json<ApiSuccessResponse<{ resumeUrl: string; isComplete: boolean }>>()
  },
}

export const jobsApi = {
  search: (params: JobSearchParams) =>
    api
      .get('jobs/search', { searchParams: { ...params } })
      .json<ApiSuccessResponse<JobListing[]> & { meta: PaginationMeta }>(),

  apply: (jobId: string) =>
    api.post('applications', { json: { jobId } }).json<ApiSuccessResponse<{ batchId: string; enqueued: number }>>(),

  batchApply: (jobIds: string[]) =>
    api
      .post('applications/batch', { json: { jobIds } })
      .json<ApiSuccessResponse<{ batchId: string; count: number }>>(),
}

export const applicationsApi = {
  list: (params?: { page?: number; perPage?: number; status?: ApplicationStatus }) =>
    api
      .get('applications', { searchParams: { ...(params ?? {}) } })
      .json<ApiSuccessResponse<Application[]> & { meta: PaginationMeta }>(),
}
