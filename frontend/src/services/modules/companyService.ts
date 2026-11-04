import { ApiService } from '@/services/core/apiService'
import type { Company } from '@/types'

export interface CreateCompanyPayload {
  name: string
  slug: string
  invoice_prefix: string
  invoice_starting_number: number
  email: string
  phone: string
  address: string
  gstin: string
  logo_url?: string | null
  seal_url?: string | null
  signature_url?: string | null
}

export interface UpdateCompanyPayload {
  name?: string
  invoice_prefix?: string
  invoice_starting_number?: number
  email?: string
  phone?: string
  address?: string
  gstin?: string
  logo_url?: string | null
  seal_url?: string | null
  signature_url?: string | null
  is_active?: boolean
}

class CompanyService extends ApiService<Company> {
  constructor() { super('/companies') }

  listCompanies() { return this.list() }
  createCompany(payload: CreateCompanyPayload) { return this.create(payload) }
  updateCompany(id: number, payload: UpdateCompanyPayload) { return this.patch(id, payload) }
  deleteCompany(id: number) { return this.remove(id) }
}

export const companyService = new CompanyService()
export default companyService
