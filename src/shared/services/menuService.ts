import { 
  menuItemsService, 
  menuCategoriesService, 
  menuVariantsService, 
  menuAddonsService, 
  menuCombosService 
} from '../firebase/firestore';
import { 
  IMenuItem, 
  IMenuCategory, 
  IMenuVariant, 
  IMenuAddon, 
  IMenuCombo 
} from '../domain/menu/types';

/**
 * Service for handling Menu Items, Categories, Variants, Addons, and Combos CRUD.
 * Interacts with Firestore canonical collections.
 */
export const menuService = {
  // --- ITEMS ---
  getItems: (tenantId?: string) => menuItemsService.getAll(tenantId) as Promise<IMenuItem[]>,
  createItem: (data: Omit<IMenuItem, 'id'> & { id?: string }, tenantId?: string) => menuItemsService.create(data, tenantId),
  updateItem: (id: string, data: Partial<IMenuItem>, tenantId?: string) => menuItemsService.update(id, data, tenantId),
  deleteItem: (id: string, tenantId?: string) => menuItemsService.delete(id, tenantId),
  listenItems: (callback: (items: IMenuItem[]) => void, tenantId?: string) => 
    menuItemsService.listen((items) => callback(items as IMenuItem[]), tenantId),

  // --- CATEGORIES ---
  getCategories: (tenantId?: string) => menuCategoriesService.getAll(tenantId) as Promise<IMenuCategory[]>,
  createCategory: (data: Omit<IMenuCategory, 'id'> & { id?: string }, tenantId?: string) => menuCategoriesService.create(data, tenantId),
  updateCategory: (id: string, data: Partial<IMenuCategory>, tenantId?: string) => menuCategoriesService.update(id, data, tenantId),
  deleteCategory: (id: string, tenantId?: string) => menuCategoriesService.delete(id, tenantId),
  listenCategories: (callback: (categories: IMenuCategory[]) => void, tenantId?: string) => 
    menuCategoriesService.listen((categories) => callback(categories as IMenuCategory[]), tenantId),

  // --- VARIANTS ---
  getVariants: (tenantId?: string) => menuVariantsService.getAll(tenantId) as Promise<IMenuVariant[]>,
  createVariant: (data: Omit<IMenuVariant, 'id'> & { id?: string }, tenantId?: string) => menuVariantsService.create(data, tenantId),
  updateVariant: (id: string, data: Partial<IMenuVariant>, tenantId?: string) => menuVariantsService.update(id, data, tenantId),
  deleteVariant: (id: string, tenantId?: string) => menuVariantsService.delete(id, tenantId),
  listenVariants: (callback: (variants: IMenuVariant[]) => void, tenantId?: string) => 
    menuVariantsService.listen((variants) => callback(variants as IMenuVariant[]), tenantId),

  // --- ADDONS ---
  getAddons: (tenantId?: string) => menuAddonsService.getAll(tenantId) as Promise<IMenuAddon[]>,
  createAddon: (data: Omit<IMenuAddon, 'id'> & { id?: string }, tenantId?: string) => menuAddonsService.create(data, tenantId),
  updateAddon: (id: string, data: Partial<IMenuAddon>, tenantId?: string) => menuAddonsService.update(id, data, tenantId),
  deleteAddon: (id: string, tenantId?: string) => menuAddonsService.delete(id, tenantId),
  listenAddons: (callback: (addons: IMenuAddon[]) => void, tenantId?: string) => 
    menuAddonsService.listen((addons) => callback(addons as IMenuAddon[]), tenantId),

  // --- COMBOS ---
  getCombos: (tenantId?: string) => menuCombosService.getAll(tenantId) as Promise<IMenuCombo[]>,
  createCombo: (data: Omit<IMenuCombo, 'id'> & { id?: string }, tenantId?: string) => menuCombosService.create(data, tenantId),
  updateCombo: (id: string, data: Partial<IMenuCombo>, tenantId?: string) => menuCombosService.update(id, data, tenantId),
  deleteCombo: (id: string, tenantId?: string) => menuCombosService.delete(id, tenantId),
  listenCombos: (callback: (combos: IMenuCombo[]) => void, tenantId?: string) => 
    menuCombosService.listen((combos) => callback(combos as IMenuCombo[]), tenantId),
};
export default menuService;


