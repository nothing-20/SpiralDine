import { ordersService, kitchenTicketsService } from '../firebase/firestore';
import { IOrder } from '../domain/orders/types';

/**
 * Service for handling Order and Kitchen Ticket database operations.
 * Connects the frontend to Firestore collection streams.
 */
export const orderService = {
  /**
   * Retrieves all orders for a tenant, or all orders if no tenant is specified.
   * 
   * @param tenantId - Optional tenant identifier to filter orders.
   * @returns A promise resolving to an array of orders.
   */
  getOrders: (tenantId?: string) => ordersService.getAll(tenantId) as Promise<IOrder[]>,

  /**
   * Retrieves a specific order by its unique ID.
   * 
   * @param id - The unique ID of the order.
   * @param tenantId - Optional tenant identifier for logical partitioning validation.
   * @returns A promise resolving to the order or null if not found.
   */
  getOrder: (id: string, tenantId?: string) => ordersService.getById(id, tenantId) as Promise<IOrder | null>,

  /**
   * Creates a new order in Firestore.
   * 
   * @param data - The order object data excluding the ID.
   * @param tenantId - Optional tenant identifier.
   * @returns A promise resolving to the created order's ID or write result.
   */
  createOrder: (data: Omit<IOrder, 'id'> & { tenantId?: string }, tenantId?: string) => {
    // Hard validation rule: Zero-item food orders must never be created
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Order creation rejected: An order must contain at least one valid menu item.');
    }
    const orderTotal = Number(data.total ?? (data as any).totalAmount ?? 0);
    if (orderTotal <= 0 && data.items.length === 0) {
      throw new Error('Order creation rejected: Order total cannot be zero with no items.');
    }
    return ordersService.create(data, { tenantId: tenantId || data.tenantId });
  },

  /**
   * Updates an existing order's fields in Firestore.
   * 
   * @param id - The unique ID of the order.
   * @param data - Partial order fields to update.
   * @param tenantId - Optional tenant identifier.
   * @returns A promise resolving when the update is complete.
   */
  updateOrder: (id: string, data: Partial<IOrder> & { tenantId?: string }, tenantId?: string) =>
    ordersService.update(id, data, { tenantId: tenantId || data.tenantId }),

  /**
   * Deletes an order from Firestore.
   * 
   * @param id - The unique ID of the order to delete.
   * @param tenantId - Optional tenant identifier.
   * @returns A promise resolving when the deletion is complete.
   */
  deleteOrder: (id: string, tenantId?: string) => ordersService.delete(id, tenantId),

  /**
   * Retrieves active kitchen tickets for the given tenant workspace.
   * 
   * @param tenantId - Optional tenant identifier.
   * @returns A promise resolving to kitchen ticket documents.
   */
  getKitchenTickets: (tenantId?: string) => kitchenTicketsService.getAll(tenantId),

  /**
   * Updates fields of a specific kitchen ticket.
   * 
   * @param id - The unique ID of the kitchen ticket.
   * @param data - Custom update parameters.
   * @param tenantId - Optional tenant identifier.
   * @returns A promise resolving when the ticket is updated.
   */
  updateKitchenTicket: (id: string, data: any, tenantId?: string) => kitchenTicketsService.update(id, data, tenantId),
};
export default orderService;

