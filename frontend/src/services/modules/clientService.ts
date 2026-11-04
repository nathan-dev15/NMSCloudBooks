import { ApiService } from '@/services/core/apiService'
import type { Client, ClientContact, ClientCommunication } from '@/features/clients/clientsSlice'
import type { QueryParams } from '@/services/core/apiService'

export interface ClientQueryParams extends QueryParams {
  client_type?: string
  segment?: string
  is_active?: boolean
}

class ClientService extends ApiService<Client> {
  constructor() { super('/clients') }

  update(id: number, payload: Record<string, unknown>) {
    return this.patch(id, payload)
  }

  // Contacts

  contacts(clientId: number) {
    return this.getRelated<ClientContact[]>(clientId, 'contacts')
  }

  addContact(clientId: number, payload: Record<string, unknown>) {
    return this.createRelated<ClientContact>(clientId, 'contacts', payload)
  }

  updateContact(clientId: number, contactId: number, payload: Record<string, unknown>) {
    return this.raw.patch<ClientContact>(`${this.url(clientId, 'contacts')}/${contactId}`, payload)
  }

  removeContact(clientId: number, contactId: number) {
    return this.raw.delete<void>(`${this.url(clientId, 'contacts')}/${contactId}`)
  }

  // Communications

  communications(clientId: number, params?: QueryParams) {
    return this.getRelated<ClientCommunication[]>(clientId, 'communications', params)
  }

  logCommunication(clientId: number, payload: Record<string, unknown>) {
    return this.createRelated<ClientCommunication>(clientId, 'communications', payload)
  }

  summary(clientId: number) {
    return this.getRelated<Record<string, unknown>>(clientId, 'summary')
  }
}

export const clientService = new ClientService()
export default clientService
