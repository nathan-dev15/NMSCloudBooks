import { createEntitySlice } from '@/app/createEntitySlice'
import apiHandler from '@/services/apiHandler'
import { createAsyncThunk } from '@reduxjs/toolkit'

export interface ClientContact {
  id: number
  client_id: number
  name: string
  designation: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
}

export interface ClientCommunication {
  id: number
  client_id: number
  logged_by_id: number | null
  comm_type: 'email' | 'call' | 'meeting' | 'note' | 'whatsapp'
  subject: string
  body: string | null
  outcome: string | null
  follow_up_date: string | null
  created_at: string
}

export interface Client {
  id: number
  tenant_id: number
  created_by_id: number | null
  display_name: string
  client_code: string | null
  client_type: 'individual' | 'company' | 'government' | 'ngo'
  segment: 'premium' | 'standard' | 'prospect' | 'inactive'
  is_active: boolean
  email: string | null
  phone: string | null
  alt_phone: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string
  gstin: string | null
  pan: string | null
  credit_limit: number | null
  credit_days: number | null
  currency: string
  outstanding_balance: number
  notes: string | null
  tags: string[]
  contacts: ClientContact[]
}

const entity = createEntitySlice<Client>('clients', '/clients')

export const {
  slice: clientsSlice,
  reducer: clientsReducer,
  thunks: clientsThunks,
  selectors: clientsSelectors,
} = entity

// Extra thunks for sub-resources

export const addContact = createAsyncThunk(
  'clients/addContact',
  async ({ clientId, data }: { clientId: number; data: Omit<ClientContact, 'id' | 'client_id'> }) => {
    const res = await apiHandler.post<ClientContact>(`/clients/${clientId}/contacts`, data)
    return { clientId, contact: res.data! }
  }
)

export const logCommunication = createAsyncThunk(
  'clients/logCommunication',
  async ({ clientId, data }: { clientId: number; data: Omit<ClientCommunication, 'id' | 'client_id' | 'logged_by_id' | 'created_at'> }) => {
    const res = await apiHandler.post<ClientCommunication>(`/clients/${clientId}/communications`, data)
    return res.data!
  }
)

export const fetchCommunications = createAsyncThunk(
  'clients/fetchCommunications',
  async ({ clientId, page = 1 }: { clientId: number; page?: number }) => {
    const res = await apiHandler.get<{ items: ClientCommunication[]; total: number; page: number; size: number }>(
      `/clients/${clientId}/communications`,
      { params: { page } }
    )
    return res.data!
  }
)

export default clientsSlice.reducer
