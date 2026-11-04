import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@/features/auth/authSlice'
import usersReducer from '@/features/users/usersSlice'
import tenantsReducer from '@/features/tenants/tenantsSlice'
import subscriptionPlansReducer from '@/features/subscriptions/subscriptionPlansSlice'
import companiesReducer from '@/features/companies/companiesSlice'
import civilReducer from '@/features/civil/civilSlice'
import notificationsReducer from '@/features/notifications/notificationsSlice'
import clientsReducer        from '@/features/clients/clientsSlice'
import invoicesReducer       from '@/features/invoices/invoicesSlice'
import purchaseOrdersReducer from '@/features/purchaseOrders/purchaseOrdersSlice'
import { purchaseRequisitionsReducer } from '@/features/purchaseRequisitions/purchaseRequisitionsSlice'
import { deliveryChallansReducer }     from '@/features/deliveryChallans/deliveryChallansSlice'
import inventoryReducer, { inventoryAuxReducer } from '@/features/inventory/inventorySlice'
import retailReducer, { retailAuxReducer }             from '@/features/retail/retailSlice'
import farmsReducer, { cyclesReducer, agricultureAuxReducer } from '@/features/agriculture/agricultureSlice'
import servicesReducer, {
  genInvoicesReducer, subscriptionsReducer, generalAuxReducer,
} from '@/features/general/generalSlice'
import mindMapsReducer from '@/features/mindMaps/mindMapsSlice'

export const store = configureStore({
  reducer: {
    auth:              authReducer,
    users:             usersReducer,
    tenants:           tenantsReducer,
    subscriptionPlans: subscriptionPlansReducer,
    companies:      companiesReducer,
    civil:          civilReducer,
    notifications:  notificationsReducer,
    clients:        clientsReducer,
    invoices:       invoicesReducer,
    purchaseOrders:        purchaseOrdersReducer,
    purchaseRequisitions:  purchaseRequisitionsReducer,
    deliveryChallans:      deliveryChallansReducer,
    inventory:      inventoryReducer,
    inventoryAux:   inventoryAuxReducer,
    retail:          retailReducer,
    retailAux:       retailAuxReducer,
    farms:           farmsReducer,
    cropCycles:      cyclesReducer,
    agricultureAux:  agricultureAuxReducer,
    services:        servicesReducer,
    genInvoices:     genInvoicesReducer,
    subscriptions:   subscriptionsReducer,
    generalAux:      generalAuxReducer,
    mindMaps:        mindMapsReducer,
  },
  devTools: typeof __DEV__ !== 'undefined' ? __DEV__ : true,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
