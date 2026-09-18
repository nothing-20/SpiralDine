import { 
  collection, 
  doc, 
  getDocs, 
  writeBatch, 
  query, 
  where,
  addDoc 
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// Cuisine presets
export interface CuisinePreset {
  name: string;
  cuisine: string;
  description: string;
  logo: string;
  coverImage: string;
  address: string;
  phone: string;
  categories: { id: string; name: string; description: string; displayOrder: number }[];
  items: { name: string; category: string; price: number; description: string; isVeg: boolean; rating: number }[];
}

export const CUISINE_PRESETS: Record<string, CuisinePreset> = {
  italian: {
    name: 'Bella Italia Bistro',
    cuisine: 'Italian Bistro & Pizza',
    description: 'An exquisite culinary journey featuring authentic stone-baked pizzas, freshly prepared pasta, and hand-crafted desserts in a premium cozy atmosphere.',
    logo: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=60',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=60',
    address: '456 Culinary Boulevard, Gastronomy City, NY 10012',
    phone: '+1 (555) 019-3829',
    categories: [
      { id: 'CAT-APPETIZERS', name: 'Appetizers', description: 'Fresh starters and salads.', displayOrder: 1 },
      { id: 'CAT-PASTA', name: 'Pasta & Risotto', description: 'Housemade fresh pastas.', displayOrder: 2 },
      { id: 'CAT-PIZZA', name: 'Artisanal Pizza', description: 'Woodfired thin crust pizzas.', displayOrder: 3 },
      { id: 'CAT-MAINS', name: 'Main Course', description: 'Classic Italian meat and fish.', displayOrder: 4 },
      { id: 'CAT-DRINKS', name: 'Beverages', description: 'Fine wines and craft soda.', displayOrder: 5 },
      { id: 'CAT-DESSERTS', name: 'Desserts', description: 'Sweet Italian treats.', displayOrder: 6 }
    ],
    items: [
      // Appetizers (8 items)
      { name: 'Bruschetta Al Pomodoro', category: 'Appetizers', price: 850, description: 'Grilled bread rubbed with garlic, fresh tomatoes, olive oil, and basil.', isVeg: true, rating: 4.6 },
      { name: 'Caprese Salad', category: 'Appetizers', price: 950, description: 'Fresh buffalo mozzarella, vine-ripened tomatoes, sweet basil, and aged balsamic.', isVeg: true, rating: 4.5 },
      { name: 'Calamari Fritti', category: 'Appetizers', price: 1250, description: 'Lightly floured crispy squid served with citrus aioli and marinara dip.', isVeg: false, rating: 4.7 },
      { name: 'Arancini Cacio e Pepe', category: 'Appetizers', price: 900, description: 'Crispy risotto balls stuffed with mozzarella, pecorino cheese, and black pepper.', isVeg: true, rating: 4.4 },
      { name: 'Tuscan Garlic Bread', category: 'Appetizers', price: 550, description: 'Toasted ciabatta with garlic-herb butter and melted provolone.', isVeg: true, rating: 4.3 },
      { name: 'Prosciutto Melon Skewers', category: 'Appetizers', price: 1100, description: 'Aged Parma ham wrapped around sweet cantaloupe wedges.', isVeg: false, rating: 4.6 },
      { name: 'Minestrone Soup', category: 'Appetizers', price: 700, description: 'Classic Italian vegetable soup served with fresh pesto oil.', isVeg: true, rating: 4.2 },
      { name: 'Burrata & Truffle Honey', category: 'Appetizers', price: 1400, description: 'Creamy burrata cheese served with baby arugula, truffle honey, and toasted walnuts.', isVeg: true, rating: 4.8 },

      // Pasta (8 items)
      { name: 'Spaghetti Carbonara', category: 'Pasta & Risotto', price: 1650, description: 'Egg yolk, pecorino romano, guanciale, and fresh cracked black pepper.', isVeg: false, rating: 4.8 },
      { name: 'Penne Alla Vodka', category: 'Pasta & Risotto', price: 1450, description: 'Penne pasta tossed in a rich tomato cream sauce spiked with Italian vodka.', isVeg: true, rating: 4.6 },
      { name: 'Lasagna Classica', category: 'Pasta & Risotto', price: 1850, description: 'Baked layers of pasta sheet, beef ragu bolognese, creamy bechamel, and mozzarella.', isVeg: false, rating: 4.9 },
      { name: 'Truffle Mushroom Risotto', category: 'Pasta & Risotto', price: 1950, description: 'Creamy carnaroli rice cooked with wild mushrooms, parmesan, and truffle essence.', isVeg: true, rating: 4.7 },
      { name: 'Pesto Gnocchi', category: 'Pasta & Risotto', price: 1500, description: 'Soft potato dumplings tossed in fresh Genovese basil pesto and pine nuts.', isVeg: true, rating: 4.5 },
      { name: 'Seafood Linguine', category: 'Pasta & Risotto', price: 2200, description: 'Linguine with clams, mussels, shrimp, and calamari in a light white wine broth.', isVeg: false, rating: 4.7 },
      { name: 'Fettuccine Alfredo', category: 'Pasta & Risotto', price: 1350, description: 'Fettuccine tossed in a rich butter, garlic, and parmesan cream sauce.', isVeg: true, rating: 4.3 },
      { name: 'Lobster Ravioli', category: 'Pasta & Risotto', price: 2400, description: 'Handmade ravioli filled with fresh lobster tail in a smooth lobster bisque cream.', isVeg: false, rating: 4.8 },

      // Pizza (8 items)
      { name: 'Margherita D.O.C.', category: 'Artisanal Pizza', price: 1350, description: 'San Marzano tomatoes, fresh buffalo mozzarella, olive oil, and sweet basil.', isVeg: true, rating: 4.7 },
      { name: 'Diavola Pizza', category: 'Artisanal Pizza', price: 1600, description: 'Crushed tomatoes, mozzarella, spicy salami, and red chilli flakes.', isVeg: false, rating: 4.8 },
      { name: 'Quattro Formaggi', category: 'Artisanal Pizza', price: 1700, description: 'Mozzarella, gorgonzola, parmesan, and creamy goat cheese.', isVeg: true, rating: 4.5 },
      { name: 'Truffle Mushroom Pizza', category: 'Artisanal Pizza', price: 1850, description: 'White base with wild mushrooms, truffle oil, arugula, and shaved parmesan.', isVeg: true, rating: 4.6 },
      { name: 'Prosciutto e Rucola', category: 'Artisanal Pizza', price: 1950, description: 'Tomato sauce, mozzarella, cured prosciutto ham, fresh baby arugula, and shaved grana padano.', isVeg: false, rating: 4.9 },
      { name: 'Ortolana Garden Pizza', category: 'Artisanal Pizza', price: 1450, description: 'Mozzarella, grilled bell peppers, zucchini, eggplant, and kalamata olives.', isVeg: true, rating: 4.4 },
      { name: 'Chicken Pesto Pizza', category: 'Artisanal Pizza', price: 1650, description: 'Basil pesto base, shredded grilled chicken, cherry tomatoes, and fresh mozzarella.', isVeg: false, rating: 4.5 },
      { name: 'Calzone Fritto', category: 'Artisanal Pizza', price: 1550, description: 'Folded pizza stuffed with ricotta, salami, mozzarella, and black pepper.', isVeg: false, rating: 4.6 },

      // Main Course (8 items)
      { name: 'Chicken Parmigiana', category: 'Main Course', price: 1950, description: 'Crispy herb-crusted chicken breast baked with marinara sauce and fresh mozzarella.', isVeg: false, rating: 4.7 },
      { name: 'Veal Saltimbocca', category: 'Main Course', price: 2600, description: 'Tender veal cutlets topped with prosciutto and sage, cooked in white wine sauce.', isVeg: false, rating: 4.8 },
      { name: 'Salmon Al Limone', category: 'Main Course', price: 2450, description: 'Pan-seared Atlantic salmon fillet with capers, baby spinach, and lemon dill cream.', isVeg: false, rating: 4.6 },
      { name: 'Bistecca Fiorentina', category: 'Main Course', price: 3450, description: 'Premium grilled T-bone steak served with rosemary potatoes and grilled asparagus.', isVeg: false, rating: 4.9 },
      { name: 'Eggplant Parmigiana', category: 'Main Course', price: 1650, description: 'Baked layers of crispy eggplant slices, tomato sauce, basil, and parmesan.', isVeg: true, rating: 4.5 },
      { name: 'Osso Buco Milanese', category: 'Main Course', price: 2950, description: 'Braised veal shanks cooked in white wine broth, served with saffron risotto.', isVeg: false, rating: 4.9 },
      { name: 'Pan-Seared Sea Bass', category: 'Main Course', price: 2750, description: 'Sea bass served with cherry tomatoes, fennel, olives, and a splash of white wine.', isVeg: false, rating: 4.7 },
      { name: 'Tuscan Garlic Shrimp', category: 'Main Course', price: 2150, description: 'Plump shrimp sautéed with garlic, spinach, sun-dried tomatoes, and heavy cream.', isVeg: false, rating: 4.5 },

      // Beverages (8 items)
      { name: 'Italian Craft Soda', category: 'Beverages', price: 350, description: 'Sparkling lemon or blood orange soda.', isVeg: true, rating: 4.2 },
      { name: 'Espresso Single Shot', category: 'Beverages', price: 250, description: 'Rich dark espresso shot brewed with premium Arabica beans.', isVeg: true, rating: 4.4 },
      { name: 'San Pellegrino 750ml', category: 'Beverages', price: 500, description: 'Premium sparkling natural mineral water.', isVeg: true, rating: 4.5 },
      { name: 'Iced Latte Macchiato', category: 'Beverages', price: 550, description: 'Chilled milk, vanilla syrup, and double shot espresso layer.', isVeg: true, rating: 4.3 },
      { name: 'Aperol Spritz (Non-Alc)', category: 'Beverages', price: 650, description: 'Mocktail version of the classic Aperol Spritz with orange bitters and club soda.', isVeg: true, rating: 4.4 },
      { name: 'House Red Wine Glass', category: 'Beverages', price: 950, description: 'Glass of premium Italian Chianti wine.', isVeg: true, rating: 4.6 },
      { name: 'House White Wine Glass', category: 'Beverages', price: 950, description: 'Glass of crisp Pinot Grigio wine.', isVeg: true, rating: 4.5 },
      { name: 'Italian Lemonade', category: 'Beverages', price: 400, description: 'Fresh squeezed lemons, sparkling water, and fresh rosemary sprig.', isVeg: true, rating: 4.3 },

      // Desserts (5 items)
      { name: 'Classic Tiramisu', category: 'Desserts', price: 850, description: 'Espresso-soaked ladyfingers layered with rich mascarpone cream and cocoa dust.', isVeg: true, rating: 4.9 },
      { name: 'Panna Cotta Al Berry', category: 'Desserts', price: 750, description: 'Silky vanilla bean custard topped with sweet fresh mixed berry coulis.', isVeg: true, rating: 4.7 },
      { name: 'Warm Chocolate Lava Cake', category: 'Desserts', price: 900, description: 'Decadent chocolate cake with a molten fudge core, served with vanilla gelato.', isVeg: true, rating: 4.8 },
      { name: 'Sicilian Cannoli Duo', category: 'Desserts', price: 700, description: 'Crispy pastry shells filled with sweet ricotta cream, chocolate chips, and pistachios.', isVeg: true, rating: 4.6 },
      { name: 'Gelato Misto', category: 'Desserts', price: 600, description: 'Three scoops of premium gelato - pistachio, dark chocolate, and salted caramel.', isVeg: true, rating: 4.5 }
    ]
  },
  japanese: {
    name: 'Sakura Zen Ramen',
    cuisine: 'Japanese Sushi & Ramen',
    description: 'Savor the true art of Japanese dining, from fresh sashimi grade fish to our 24-hour slow-cooked signature ramen bowls.',
    logo: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=150&auto=format&fit=crop&q=60',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=60',
    address: '12 Main Street, Tokyo Town, San Francisco, CA 94107',
    phone: '+1 (555) 019-4820',
    categories: [
      { id: 'CAT-STARTERS', name: 'Zensai Starters', description: 'Japanese hot and cold starters.', displayOrder: 1 },
      { id: 'CAT-RAMEN', name: 'Signature Ramen', description: '24-hour slow cooked broth noodle bowls.', displayOrder: 2 },
      { id: 'CAT-SUSHI', name: 'Sushi & Sashimi', description: 'Fresh rolls and raw fish plates.', displayOrder: 3 },
      { id: 'CAT-DONBURI', name: 'Rice Bowls & Entrees', description: 'Classic hot meals served on steamed rice.', displayOrder: 4 },
      { id: 'CAT-DRINKS', name: 'Beverages', description: 'Premium matchas, sake, and bubble teas.', displayOrder: 5 },
      { id: 'CAT-DESSERTS', name: 'Desserts', description: 'Delicate sweet Japanese desserts.', displayOrder: 6 }
    ],
    items: [
      // Starters (8 items)
      { name: 'Edamame Sea Salt', category: 'Zensai Starters', price: 450, description: 'Steamed green soybean pods tossed with flaky sea salt.', isVeg: true, rating: 4.1 },
      { name: 'Pork Gyoza Dumplings', category: 'Zensai Starters', price: 850, description: 'Pan-seared pork and chive potstickers served with soy chili dip.', isVeg: false, rating: 4.6 },
      { name: 'Agedashi Tofu', category: 'Zensai Starters', price: 700, description: 'Crispy fried tofu blocks in a warm savory dashi broth with bonito flakes.', isVeg: true, rating: 4.4 },
      { name: 'Chicken Karaage', category: 'Zensai Starters', price: 950, description: 'Japanese style crispy garlic-ginger fried chicken bites with spicy mayo.', isVeg: false, rating: 4.7 },
      { name: 'Shrimp Tempura Duo', category: 'Zensai Starters', price: 1100, description: 'Light and airy tempura battered prawns and sweet potatoes.', isVeg: false, rating: 4.5 },
      { name: 'Seaweed Salad', category: 'Zensai Starters', price: 550, description: 'Chilled sesame oil marinated wakame seaweed salad.', isVeg: true, rating: 4.2 },
      { name: 'Takoyaki Octopus Balls', category: 'Zensai Starters', price: 900, description: 'Fried batter balls with octopus centers, topped with kewpie, brown sauce, and nori.', isVeg: false, rating: 4.6 },
      { name: 'Miso Soup', category: 'Zensai Starters', price: 350, description: 'Traditional white miso paste broth with silken tofu, seaweed, and scallions.', isVeg: true, rating: 4.3 },

      // Ramen (8 items)
      { name: 'Tonkotsu Classic Ramen', category: 'Signature Ramen', price: 1750, description: 'Rich pork bone broth, thin noodles, chashu pork belly, soft egg, bamboo, and woodear mushrooms.', isVeg: false, rating: 4.9 },
      { name: 'Spicy TanTan Ramen', category: 'Signature Ramen', price: 1650, description: 'Sesame peanut broth, wavy noodles, minced spicy chicken, bok choy, and soft boiled egg.', isVeg: false, rating: 4.8 },
      { name: 'Shoyu Clean Broth Ramen', category: 'Signature Ramen', price: 1550, description: 'Soy sauce chicken broth, thin noodles, grilled chicken, egg, nori sheet, and scallions.', isVeg: false, rating: 4.6 },
      { name: 'Creamy Veggie Ramen', category: 'Signature Ramen', price: 1600, description: 'Rich vegetable and soy milk broth, curly noodles, fried tofu, corn, mushrooms, and black garlic oil.', isVeg: true, rating: 4.7 },
      { name: 'Miso Spicy Pork Ramen', category: 'Signature Ramen', price: 1700, description: 'Rich miso based broth, chashu pork belly, sweet corn, cabbage, and red chili oil.', isVeg: false, rating: 4.7 },
      { name: 'Black Garlic Tonkotsu', category: 'Signature Ramen', price: 1850, description: 'Our signature Tonkotsu pork broth elevated with charred black garlic oil.', isVeg: false, rating: 4.9 },
      { name: 'Tsukemen Dipping Noodle', category: 'Signature Ramen', price: 1900, description: 'Thick cold noodles served alongside an ultra-concentrated hot pork dashi broth.', isVeg: false, rating: 4.8 },
      { name: 'Shio Seafood Noodle', category: 'Signature Ramen', price: 1800, description: 'Light sea salt broth loaded with mussels, shrimp, scallops, and fresh spinach.', isVeg: false, rating: 4.5 },

      // Sushi (8 items)
      { name: 'California Roll', category: 'Sushi & Sashimi', price: 950, description: 'Snow crab, avocado, cucumber, rolled in toasted sesame seeds.', isVeg: false, rating: 4.4 },
      { name: 'Spicy Tuna Roll', category: 'Sushi & Sashimi', price: 1150, description: 'Spicy minced yellowfin tuna, cucumber, topped with sriracha mayo.', isVeg: false, rating: 4.6 },
      { name: 'Salmon Nigiri Platter', category: 'Sushi & Sashimi', price: 1400, description: '5 pieces of fresh Atlantic salmon over pressed vinegared sushi rice.', isVeg: false, rating: 4.7 },
      { name: 'Tuna Sashimi Trio', category: 'Sushi & Sashimi', price: 1800, description: 'Thick slices of raw prime bluefin, bigeye, and yellowfin tuna.', isVeg: false, rating: 4.8 },
      { name: 'Dragon Special Roll', category: 'Sushi & Sashimi', price: 1750, description: 'Shrimp tempura, eel inside, topped with avocado sheets, unagi sweet glaze, and fish eggs.', isVeg: false, rating: 4.9 },
      { name: 'Avocado Cucumber Veg Roll', category: 'Sushi & Sashimi', price: 750, description: 'Fresh avocado, cucumber, and pickled radish wrapped in nori.', isVeg: true, rating: 4.3 },
      { name: 'Rainbow Roll', category: 'Sushi & Sashimi', price: 1650, description: 'California roll base wrapped in slices of tuna, salmon, shrimp, and avocado.', isVeg: false, rating: 4.8 },
      { name: 'Volcano Baked Roll', category: 'Sushi & Sashimi', price: 1850, description: 'Spicy crab roll baked with scallop topping and lava spicy cheese glaze.', isVeg: false, rating: 4.7 },

      // Donburi (8 items)
      { name: 'Chicken Katsu Curry', category: 'Rice Bowls & Entrees', price: 1550, description: 'Crispy fried panko chicken cutlet served with thick Japanese curry and rice.', isVeg: false, rating: 4.8 },
      { name: 'Gydon Beef Bowl', category: 'Rice Bowls & Entrees', price: 1450, description: 'Thinly sliced beef simmered with onions in soy-mirin broth on rice, with red ginger.', isVeg: false, rating: 4.5 },
      { name: 'Unagi Don Eel Bowl', category: 'Rice Bowls & Entrees', price: 2150, description: 'Grilled sweet freshwater eel fillets served on bed of rice with unagi glaze.', isVeg: false, rating: 4.9 },
      { name: 'Salmon Teriyaki Box', category: 'Rice Bowls & Entrees', price: 1850, description: 'Pan-seared salmon coated in sweet teriyaki sauce, served with broccoli and rice.', isVeg: false, rating: 4.6 },
      { name: 'Oyako Chicken Egg Don', category: 'Rice Bowls & Entrees', price: 1350, description: 'Simmered chicken thighs, onions, and whisked eggs in a dashi soy soup.', isVeg: false, rating: 4.4 },
      { name: 'Tofu Teriyaki Bowl', category: 'Rice Bowls & Entrees', price: 1250, description: 'Crispy pan-fried tofu glazed in home-made teriyaki sauce with steam rice.', isVeg: true, rating: 4.3 },
      { name: 'Pork Tonkatsu Bowl', category: 'Rice Bowls & Entrees', price: 1450, description: 'Crispy pork cutlet simmered with sweet onions and eggs in dashi broth.', isVeg: false, rating: 4.5 },
      { name: 'Ten Don Tempura Bowl', category: 'Rice Bowls & Entrees', price: 1600, description: 'Deep fried prawns and seasonal vegetables on rice, drizzled with tempura sauce.', isVeg: false, rating: 4.6 },

      // Beverages (8 items)
      { name: 'Iced Uji Matcha Latte', category: 'Beverages', price: 550, description: 'Premium grade Japanese Uji matcha green tea whisked with cold milk.', isVeg: true, rating: 4.7 },
      { name: 'Premium Sencha Hot Tea', category: 'Beverages', price: 300, description: 'Pot of hot steamed organic Japanese green tea leaves.', isVeg: true, rating: 4.5 },
      { name: 'Oolong Cold Milk Tea', category: 'Beverages', price: 500, description: 'Chilled roasted oolong milk tea with honey and tapioca pearls.', isVeg: true, rating: 4.4 },
      { name: 'Hokkaido Melon Soda', category: 'Beverages', price: 450, description: 'Vibrant green melon flavored soda topped with a scoop of vanilla ice cream.', isVeg: true, rating: 4.3 },
      { name: 'Ramune Citrus Soda', category: 'Beverages', price: 350, description: 'Classic codd-neck glass bottle carbonated drink with marble stopper.', isVeg: true, rating: 4.2 },
      { name: 'Non-Alc Sake Cooler', category: 'Beverages', price: 600, description: 'Cool mocktail with white grape juice, cucumber, elderflower, and tonic.', isVeg: true, rating: 4.3 },
      { name: 'Ginger Beer Craft', category: 'Beverages', price: 400, description: 'Spicy and refreshing carbonated ginger root brew.', isVeg: true, rating: 4.2 },
      { name: 'Calpico Water Original', category: 'Beverages', price: 350, description: 'Classic sweet lactic acid-based uncarbonated yogurt drink.', isVeg: true, rating: 4.1 },

      // Desserts (5 items)
      { name: 'Matcha Mochi Ice Cream', category: 'Desserts', price: 650, description: 'Three sweet rice dough wraps filled with premium matcha green tea ice cream.', isVeg: true, rating: 4.7 },
      { name: 'Yuzu Cheesecake Slice', category: 'Desserts', price: 800, description: 'Creamy style cheesecake infused with citrusy Japanese yuzu juice.', isVeg: true, rating: 4.8 },
      { name: 'Double Chocolate Taiyaki', category: 'Desserts', price: 600, description: 'Warm fish-shaped waffle cake stuffed with molten dark chocolate fudge.', isVeg: true, rating: 4.6 },
      { name: 'Black Sesame Soufflé Pancake', category: 'Desserts', price: 900, description: 'Fluffy jiggly Japanese pancakes served with black sesame cream and honey.', isVeg: true, rating: 4.9 },
      { name: 'Red Bean Dorayaki', category: 'Desserts', price: 550, description: 'Traditional sweet honey pancakes sandwiched with sweet azuki red bean paste.', isVeg: true, rating: 4.4 }
    ]
  }
};

export const demoService = {
  /**
   * Resets all tenant collections and seeds realistic demo data
   */
  seedDemoRestaurant: async (tenantId: string, presetKey: 'italian' | 'japanese'): Promise<{ success: boolean; message: string }> => {
    if (!import.meta.env.DEV) {
      throw new Error('Demo restaurant seeding is strictly disabled in production.');
    }
    if (!tenantId) throw new Error('Tenant ID is required for demo seeding.');
    
    const preset = CUISINE_PRESETS[presetKey];
    if (!preset) throw new Error(`Preset "${presetKey}" not found.`);

    console.log(`[DemoSeeder] Initializing demo reset for tenant: ${tenantId}`);

    // Subcollections lists to wipe out
    const subcollections = [
      'menu/default/categories',
      'menu/default/items',
      'tables',
      'inventory',
      'orders',
      'satisfactionRatings',
      'managerReviews',
      'strategyPlans',
      'jobsHistory',
      'automationRules',
      'alerts',
      'events'
    ];

    // 1. Delete documents in subcollections
    for (const subName of subcollections) {
      const colRef = collection(db, 'restaurants', tenantId, subName);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // 2. Delete employees (filtered root collection)
    const empRef = collection(db, 'employees');
    const empSnap = await getDocs(query(empRef, where('tenantId', '==', tenantId)));
    if (!empSnap.empty) {
      const batch = writeBatch(db);
      empSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Write Tenant profile configuration details
    const tenantRef = doc(db, 'tenants', tenantId);
    const batch = writeBatch(db);

    batch.set(tenantRef, {
      id: tenantId,
      tenantId: tenantId,
      name: preset.name,
      restaurantName: preset.name,
      logoUrl: preset.logo,
      logo: preset.logo,
      coverImage: preset.coverImage,
      cuisine: preset.cuisine,
      rating: 4.8,
      description: preset.description,
      address: preset.address,
      phone: preset.phone,
      email: `${presetKey}@restaurantos.com`,
      planTier: 'enterprise',
      status: 'active',
      businessHours: {
        openingTime: '09:00',
        closingTime: '22:00',
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        holidaySettings: 'None'
      },
      settings: {
        currency: 'USD',
        timezone: 'EST',
        language: 'en',
        taxPercent: 8,
        serviceCharge: 10,
        tableServiceEnabled: true,
        qrOrderingEnabled: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });


    // 5. Seed Layout Config Settings
    const layoutRef = doc(db, 'restaurants', tenantId, 'settings', 'layout');
    batch.set(layoutRef, {
      floors: [
        { id: 'FLR-GROUND', name: 'Main Dining Hall' },
        { id: 'FLR-TERRACE', name: 'Garden Terrace' }
      ],
      sections: [
        { id: 'SEC-INDOOR', floorId: 'FLR-GROUND', name: 'Indoor Main' },
        { id: 'SEC-PATIO', floorId: 'FLR-GROUND', name: 'Outdoor Patio' },
        { id: 'SEC-VIP', floorId: 'FLR-TERRACE', name: 'VIP Garden Lounge' }
      ]
    });

    // 6. Seed Categories
    preset.categories.forEach((cat) => {
      const ref = doc(db, 'restaurants', tenantId, 'menu/default/categories', cat.id);
      batch.set(ref, {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
        isActive: true,
        image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60`
      });
    });

    // Maps for categories/stations
    const catMap: Record<string, string> = {};
    preset.categories.forEach(c => catMap[c.name] = c.id);

    const stationMap: Record<string, string> = {
      'Appetizers': 'Pantry',
      'Zensai Starters': 'Pantry',
      'Pasta & Risotto': 'Hot Kitchen',
      'Signature Ramen': 'Ramen Station',
      'Artisanal Pizza': 'Pizza Oven',
      'Sushi & Sashimi': 'Sushi Bar',
      'Main Course': 'Hot Kitchen',
      'Rice Bowls & Entrees': 'Hot Kitchen',
      'Beverages': 'Beverage Bar',
      'Desserts': 'Dessert Station'
    };

    // 7. Seed 40-50 Menu Items
    preset.items.forEach((item, index) => {
      const itemId = `MENU-${(index + 1).toString().padStart(3, '0')}`;
      const ref = doc(db, 'restaurants', tenantId, 'menu/default/items', itemId);
      const categoryId = catMap[item.category] || preset.categories[0].id;
      const station = stationMap[item.category] || 'Hot Kitchen';

      batch.set(ref, {
        id: itemId,
        name: item.name,
        categoryId,
        category: item.category,
        description: item.description,
        price: item.price,
        image: `https://picsum.photos/300/300?random=${index + 101}`,
        imageUrl: `https://picsum.photos/300/300?random=${index + 101}`,
        available: true,
        isAvailable: true,
        preparationTime: 8 + (index % 5) * 3,
        rating: item.rating,
        isVeg: item.isVeg,
        veg: item.isVeg,
        isBestSeller: index % 6 === 0,
        isRecommended: index % 8 === 0,
        spiceLevel: index % 5 === 0 ? 'medium' : 'none',
        tags: item.isVeg ? ['Veg'] : ['Non-Veg'],
        station,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 8. Seed 15 Tables
    const tableSpecs = [
      { number: '1', name: 'Table 1', floor: 'Main Dining Hall', section: 'Indoor Main', capacity: 2, shape: 'circle', x: 15, y: 15, status: 'Available' },
      { number: '2', name: 'Table 2', floor: 'Main Dining Hall', section: 'Indoor Main', capacity: 4, shape: 'square', x: 45, y: 15, status: 'Occupied' },
      { number: '3', name: 'Table 3', floor: 'Main Dining Hall', section: 'Indoor Main', capacity: 4, shape: 'square', x: 75, y: 15, status: 'bill_requested' },
      { number: '4', name: 'Table 4', floor: 'Main Dining Hall', section: 'Indoor Main', capacity: 6, shape: 'rectangle', x: 15, y: 45, status: 'Available' },
      { number: '5', name: 'Table 5', floor: 'Main Dining Hall', section: 'Indoor Main', capacity: 2, shape: 'circle', x: 45, y: 45, status: 'occupied' },
      { number: '6', name: 'Table 6', floor: 'Main Dining Hall', section: 'Indoor Main', capacity: 4, shape: 'square', x: 75, y: 45, status: 'service_requested' },
      
      { number: '7', name: 'Table 7', floor: 'Main Dining Hall', section: 'Outdoor Patio', capacity: 4, shape: 'square', x: 20, y: 80, status: 'Available' },
      { number: '8', name: 'Table 8', floor: 'Main Dining Hall', section: 'Outdoor Patio', capacity: 2, shape: 'circle', x: 50, y: 80, status: 'occupied' },
      { number: '9', name: 'Table 9', floor: 'Main Dining Hall', section: 'Outdoor Patio', capacity: 4, shape: 'square', x: 80, y: 80, status: 'Available' },
      
      { number: '10', name: 'Table 10', floor: 'Garden Terrace', section: 'VIP Garden Lounge', capacity: 2, shape: 'circle', x: 10, y: 20, status: 'Available' },
      { number: '11', name: 'Table 11', floor: 'Garden Terrace', section: 'VIP Garden Lounge', capacity: 4, shape: 'square', x: 40, y: 20, status: 'occupied' },
      { number: '12', name: 'Table 12', floor: 'Garden Terrace', section: 'VIP Garden Lounge', capacity: 8, shape: 'rectangle', x: 70, y: 20, status: 'cleaning' },
      { number: '13', name: 'Table 13', floor: 'Garden Terrace', section: 'VIP Garden Lounge', capacity: 4, shape: 'square', x: 10, y: 60, status: 'Available' },
      { number: '14', name: 'Table 14', floor: 'Garden Terrace', section: 'VIP Garden Lounge', capacity: 4, shape: 'square', x: 40, y: 60, status: 'Available' },
      { number: '15', name: 'Table 15', floor: 'Garden Terrace', section: 'VIP Garden Lounge', capacity: 2, shape: 'circle', x: 70, y: 60, status: 'Available' }
    ];
    tableSpecs.forEach((spec) => {
      const tableId = `TBL-${spec.number}`;
      const ref = doc(db, 'restaurants', tenantId, 'tables', tableId);
      const qrCodeUrl = `${window.location.origin}/r/${tenantId}/table/${tableId}`;

      batch.set(ref, {
        id: tableId,
        tableId,
        tableNumber: spec.number,
        tableName: spec.name,
        number: spec.number,
        floor: spec.floor,
        section: spec.section,
        capacity: spec.capacity,
        seatingCapacity: spec.capacity,
        status: spec.status,
        tableStatus: spec.status,
        shape: spec.shape,
        positionX: spec.x,
        positionY: spec.y,
        qrCodeId: `QR-${tableId}`,
        qrCodeUrl,
        branchId: 'main',
        isActive: true,
        notes: `Standard seating layout for ${spec.name}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 9. Seed 5 Employees
    const employees = [
      { id: 'emp-1', name: 'Owner Jack', role: 'owner', email: 'owner@saas.com' },
      { id: 'emp-2', name: 'Manager Arthur', role: 'admin', email: 'arthur@saas.com' },
      { id: 'emp-3', name: 'Chef Mario', role: 'kitchen', email: 'mario@saas.com' },
      { id: 'emp-4', name: 'Waiter Peter', role: 'waiter', email: 'peter@saas.com' },
      { id: 'emp-5', name: 'Waiter Jane', role: 'waiter', email: 'jane@saas.com' }
    ];
    employees.forEach((emp) => {
      const ref = doc(db, 'employees', `${tenantId}-${emp.id}`);
      batch.set(ref, {
        id: `${tenantId}-${emp.id}`,
        uid: `${tenantId}-${emp.id}`,
        name: emp.name,
        role: emp.role,
        email: emp.email,
        phone: '+1 (555) 012-3844',
        status: 'active',
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 10. Seed Inventory (25 items with low stock & expiring)
    const rawInv = [
      { name: 'Fresh Tomatoes', category: 'Vegetables', currentStock: 80, minimumStock: 20, unit: 'kg', cost: 180, daysToExpiry: 12 },
      { name: 'Red Onions', category: 'Vegetables', currentStock: 12, minimumStock: 25, unit: 'kg', cost: 140, daysToExpiry: 15 }, // low stock
      { name: 'Basmati Rice', category: 'Dry Goods', currentStock: 150, minimumStock: 30, unit: 'kg', cost: 320, daysToExpiry: 90 },
      { name: 'Premium Cheese', category: 'Dairy', currentStock: 0, minimumStock: 12, unit: 'kg', cost: 650, daysToExpiry: 14 }, // critical out
      { name: 'Fresh Paneer', category: 'Dairy', currentStock: 30, minimumStock: 10, unit: 'kg', cost: 420, daysToExpiry: 2 }, // expiring soon
      { name: 'Cooking Butter', category: 'Dairy', currentStock: 8, minimumStock: 15, unit: 'kg', cost: 350, daysToExpiry: 25 }, // low stock
      { name: 'Chicken Breast', category: 'Meat', currentStock: 50, minimumStock: 15, unit: 'kg', cost: 580, daysToExpiry: 3 }, // expiring soon
      { name: 'Cream Heavy', category: 'Dairy', currentStock: 18, minimumStock: 6, unit: 'liters', cost: 220, daysToExpiry: 4 },
      { name: 'Organic Flour', category: 'Dry Goods', currentStock: 100, minimumStock: 20, unit: 'kg', cost: 120, daysToExpiry: 60 },
      { name: 'Refined Sugar', category: 'Dry Goods', currentStock: 50, minimumStock: 10, unit: 'kg', cost: 95, daysToExpiry: 120 },
      { name: 'Extra Virgin Olive Oil', category: 'Dry Goods', currentStock: 24, minimumStock: 8, unit: 'liters', cost: 720, daysToExpiry: 180 },
      { name: 'Fresh Basil leaves', category: 'Vegetables', currentStock: 2, minimumStock: 5, unit: 'kg', cost: 280, daysToExpiry: 2 }, // low stock / expiring
      { name: 'Garlic cloves', category: 'Vegetables', currentStock: 15, minimumStock: 5, unit: 'kg', cost: 150, daysToExpiry: 30 },
      { name: 'Spices Mix Powder', category: 'Dry Goods', currentStock: 20, minimumStock: 5, unit: 'kg', cost: 380, daysToExpiry: 90 },
      { name: 'Fresh Salmon fillet', category: 'Meat', currentStock: 0, minimumStock: 8, unit: 'kg', cost: 1100, daysToExpiry: 3 } // depleted
    ];
    rawInv.forEach((item, index) => {
      const itemId = `INV-${(index + 1).toString().padStart(3, '0')}`;
      const ref = doc(db, 'restaurants', tenantId, 'inventory', itemId);
      
      const stock = item.currentStock;
      const min = item.minimumStock;
      let status = 'healthy';
      if (stock === 0) status = 'out_of_stock';
      else if (stock <= min) status = 'low';

      batch.set(ref, {
        id: itemId,
        name: item.name,
        category: item.category,
        currentStock: stock,
        currentQuantity: stock,
        minimumStock: min,
        minimumQuantity: min,
        reorderThreshold: min,
        unit: item.unit,
        supplier: 'Gourmet Logistics Inc.',
        cost: item.cost,
        status,
        purchaseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + item.daysToExpiry * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 11. Seed 10 Sample Orders
    const sampleOrders = [
      { orderId: 'ORD-001', customer: 'Aria Taylor', table: '2', status: 'COMPLETED', total: 2450, time: 24 },
      { orderId: 'ORD-002', customer: 'Sophia Lin', table: '5', status: 'COMPLETED', total: 1850, time: 35 },
      { orderId: 'ORD-003', customer: 'David Smith', table: '8', status: 'DELIVERED', total: 3200, time: 10 },
      { orderId: 'ORD-004', customer: 'Emma Watson', table: '11', status: 'PREPARING', total: 1450, time: 8 },
      { orderId: 'ORD-005', customer: 'Chris Evans', table: '3', status: 'READY', total: 4200, time: 15 },
      { orderId: 'ORD-006', customer: 'Robert Downey', table: '6', status: 'ACCEPTED', total: 2900, time: 2 },
      { orderId: 'ORD-007', customer: 'Scarlett J', table: '12', status: 'PLACED', total: 1250, time: 1 },
      { orderId: 'ORD-008', customer: 'Mark Ruffalo', table: '7', status: 'CANCELLED', total: 950, time: 30 },
      { orderId: 'ORD-009', customer: 'Tom Holland', table: '10', status: 'COMPLETED', total: 3850, time: 20 },
      { orderId: 'ORD-010', customer: 'Zendaya Coleman', table: '4', status: 'PREPARING', total: 2100, time: 5 }
    ];
    sampleOrders.forEach((o, index) => {
      const ref = doc(db, 'restaurants', tenantId, 'orders', o.orderId);
      
      const orderItems = [
        { itemId: 'MENU-001', name: preset.items[0].name, count: 1, pricePerUnit: preset.items[0].price, notes: '' },
        { itemId: 'MENU-009', name: preset.items[8].name, count: 1, pricePerUnit: preset.items[8].price, notes: 'No spice' }
      ];

      batch.set(ref, {
        orderId: o.orderId,
        customerName: o.customer,
        tableNumber: o.table,
        items: orderItems,
        quantity: 2,
        subtotal: o.total,
        tax: Math.round(o.total * 0.08),
        total: o.total + Math.round(o.total * 0.08),
        status: o.status,
        statusText: o.status === 'COMPLETED' || o.status === 'DELIVERED' ? 'Served' : 'Active',
        waiterName: index % 2 === 0 ? 'Waiter Peter' : 'Waiter Jane',
        deliveryDurationSeconds: o.status === 'COMPLETED' || o.status === 'DELIVERED' ? 240 + (index % 3) * 60 : 0,
        inventoryDeducted: o.status === 'COMPLETED',
        tenantId,
        createdAt: new Date(Date.now() - o.time * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - (o.time - 5) * 60 * 1000).toISOString()
      });
    });

    // 12. Seed Satisfaction Ratings (10 ratings: positive & negative)
    const reviews = [
      { score: 'Excellent', rating: 'Excellent', text: 'Stunning hospitality and gorgeous fresh flavors!', repeat: true, dayOffset: 1 },
      { score: 'Excellent', rating: 'Excellent', text: 'The food prep speed was blazing fast. Fully recommend.', repeat: true, dayOffset: 1 },
      { score: 'Good', rating: 'Good', text: 'Cozy setting, polite waiter, delicious entrees.', repeat: false, dayOffset: 2 },
      { score: 'Neutral', rating: 'Neutral', text: 'Decent food, but waiting time was almost 35 mins.', repeat: false, dayOffset: 2 },
      { score: 'Needs Attention', rating: 'Needs Attention', text: 'The order took way too long and bread was slightly burnt.', repeat: true, dayOffset: 3 },
      { score: 'Complaint', rating: 'Complaint', text: 'Found hair in salad. Saff did not resolve quickly.', repeat: false, dayOffset: 3 },
      { score: 'Excellent', rating: 'Excellent', text: 'Flawless execution, beautiful presentation.', repeat: true, dayOffset: 4 }
    ];
    reviews.forEach((r, idx) => {
      const ref = doc(db, 'restaurants', tenantId, 'satisfactionRatings', `REV-${idx + 1}`);
      batch.set(ref, {
        id: `REV-${idx + 1}`,
        rating: r.rating,
        feedback: r.text,
        repeatCustomer: r.repeat,
        customerName: `Customer ${idx + 1}`,
        tenantId,
        createdAt: new Date(Date.now() - r.dayOffset * 24 * 60 * 60 * 1000).toISOString()
      });
    });

    // 13. Seed Manager Reviews (Service Recovery Tasks)
    const recoveryTasks = [
      { id: 'REC-001', ratingId: 'REV-5', score: 'Needs Attention', text: 'The order took way too long and bread was slightly burnt.', status: 'Pending' },
      { id: 'REC-002', ratingId: 'REV-6', score: 'Complaint', text: 'Found hair in salad. Saff did not resolve quickly.', status: 'Pending' }
    ];
    recoveryTasks.forEach((t) => {
      const ref = doc(db, 'restaurants', tenantId, 'managerReviews', t.id);
      batch.set(ref, {
        id: t.id,
        satisfactionRatingId: t.ratingId,
        originalRating: t.score,
        feedbackText: t.text,
        resolutionStatus: t.status,
        resolutionNotes: '',
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 14. Seed Strategy Plans
    const strategies = [
      { id: 'STR-001', title: 'Lunch Hour Combos Offer', type: 'marketing', expectedRoiPercent: 140, reason: 'Midday traffic dips by 12% on weekdays, while ingredient stocks remain surplus.', benefit: 'Boost midday ticket volumes by 15%.' },
      { id: 'STR-002', title: 'Spoilage Safety SOP', type: 'operational', expectedRoiPercent: 110, reason: 'Fresh salmon and dairy items are expiring in less than 3 days.', benefit: 'Reduce waste cost ratios by 22%.' },
      { id: 'STR-003', title: 'Loyalty Campaign Setup', type: 'retention', expectedRoiPercent: 180, reason: 'CSAT analysis shows 74% repeat rate. Cultivating advocates builds stable bookings.', benefit: 'Increase repeat dining counts.' }
    ];
    strategies.forEach((s) => {
      const ref = doc(db, 'restaurants', tenantId, 'strategyPlans', s.id);
      batch.set(ref, {
        id: s.id,
        title: s.title,
        type: s.type,
        status: 'recommended',
        expectedRoiPercent: s.expectedRoiPercent,
        reason: s.reason,
        expectedBenefit: s.benefit,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 15. Seed Jobs History & Automation rules
    const jobs = [
      { id: 'JOB-001', name: 'Background Stock Safety Audit', status: 'completed', duration: 120 },
      { id: 'JOB-002', name: 'Expiry Dates Calendar Monitor', status: 'completed', duration: 80 },
      { id: 'JOB-003', name: 'Daily Business Brief Compilation', status: 'completed', duration: 320 },
      { id: 'JOB-004', name: 'Stock Safety Reorder Sweep', status: 'completed', duration: 150 }
    ];
    jobs.forEach((j, index) => {
      const ref = doc(db, 'restaurants', tenantId, 'jobsHistory', j.id);
      batch.set(ref, {
        id: j.id,
        name: j.name,
        status: j.status,
        startedAt: new Date(Date.now() - (index * 2) * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - (index * 2) * 60 * 60 * 1000 + j.duration * 1000).toISOString(),
        result: `Scanned all active records. Successfully updated and logged events.`
      });
    });

    const rules = [
      { id: 'RULE-001', name: 'Auto-Replenish low stock alerts', event: 'low_stock_trigger', action: 'send_supplier_email', enabled: true },
      { id: 'RULE-002', name: 'CSAT review safety valve', event: 'negative_rating', action: 'create_recovery_task', enabled: true },
      { id: 'RULE-003', name: 'Daily executive brief compiler', event: 'midnight_timer', action: 'compile_intelligence', enabled: true }
    ];
    rules.forEach((r) => {
      const ref = doc(db, 'restaurants', tenantId, 'automationRules', r.id);
      batch.set(ref, {
        ...r,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 16. Seed Alerts
    const alerts = [
      { id: 'ALT-001', title: 'Low Stock: Red Onions', severity: 'warning', message: 'Red Onions are below reorder levels (12kg remaining).' },
      { id: 'ALT-002', title: 'Negative CSAT: Customer 6', severity: 'critical', message: 'Received a Complaint rating: "Found hair in salad."' },
      { id: 'ALT-003', title: 'Out of Stock: Premium Cheese', severity: 'critical', message: 'Premium Cheese is fully depleted. Prepare replacements.' }
    ];
    alerts.forEach((a) => {
      const ref = doc(db, 'restaurants', tenantId, 'alerts', a.id);
      batch.set(ref, {
        ...a,
        read: false,
        tenantId,
        createdAt: new Date().toISOString()
      });
    });

    // Commit all batched operations
    await batch.commit();

    // 17. Seed Event Engine logs (Historical logs for Decision Feed!)
    const events = [
      { time: 180, title: 'Restaurant opened', desc: 'Shift started, cash drawer float initialized at $200.00.', type: 'System', category: 'System' as const },
      { time: 165, title: 'Inventory audit completed', desc: 'Auto low-stock scan triggered: 3 items flagged below thresholds.', type: 'System', category: 'System' as const },
      { time: 120, title: 'Lunch rush commenced', desc: 'Active dining counts surged to 6 occupied tables.', type: 'Operational', category: 'Operational' as const },
      { time: 90, title: 'Revenue exceeds yesterday', desc: 'Billing receipts reached $1,250.00, pacing 8% higher than yesterday.', type: 'Financial', category: 'Billing' as const },
      { time: 65, title: 'Kitchen delay detected', desc: 'Average food prep latency reached 16 mins. High KDS queue load.', type: 'System', category: 'Operational' as const },
      { time: 45, title: 'Purchase suggestion generated', desc: 'Strategy engine compiled reorder drafts for depleted cheese.', type: 'System', category: 'System' as const },
      { time: 10, title: 'Business strategy recommended', desc: 'Proposed "Lunch Hour Combos" with expected 140% ROI.', type: 'System', category: 'Management' as const }
    ];

    for (const ev of events) {
      await addDoc(collection(db, 'restaurants', tenantId, 'events'), {
        eventType: ev.type,
        eventCategory: ev.category,
        tenantId,
        performedBy: 'System Engine',
        performedByRole: 'system',
        title: ev.title,
        description: ev.desc,
        timestamp: new Date(Date.now() - ev.time * 60 * 1000).toISOString()
      });
    }

    console.log(`[DemoSeeder] Demo restaurant seeded successfully: ${preset.name}`);
    return { success: true, message: `Successfully loaded ${preset.cuisine} preset demo dataset.` };
  }
};
