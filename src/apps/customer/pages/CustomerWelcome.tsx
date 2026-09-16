import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  MapPin, 
  Globe, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Coffee, 
  Phone, 
  Calendar, 
  ArrowRight,
  Wifi,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { customerService, isRestaurantOpen } from '../../../shared/services/customerService';
import { QrParamsSchema } from '../../../shared/domain/customer/validation';
import Button from '../../../shared/ui/buttons/Button';
import Card from '../../../shared/ui/cards/Card';
import Modal from '../../../shared/ui/dialogs/Modal';
import LoadingSpinner from '../../../shared/ui/loading/LoadingSpinner';
import Badge from '../../../shared/ui/badges/Badge';
import Select from '../../../shared/ui/inputs/Select';

export const CustomerWelcome: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Validation States
  const [isValidating, setIsValidating] = useState(true);
  const [errorType, setErrorType] = useState<string | null>(null);
  
  // Data States
  const [restaurant, setRestaurant] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [table, setTable] = useState<any>(null);
  
  // Session States
  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  
  // UI Customizations
  const [selectedLang, setSelectedLang] = useState('en');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Language Dictionary (English, Spanish, French, German)
  const translations: Record<string, any> = {
    en: {
      welcome: 'Welcome to',
      startDining: 'Start Dining',
      aboutUs: 'About Restaurant',
      aboutDesc: 'Discover our story, hours, and details.',
      openTill: 'Open until',
      closed: 'Closed right now',
      prepTime: 'Est. Prep Time',
      seats: 'Seats',
      status: 'Status',
      available: 'Available',
      invalidQR: 'Invalid QR Code',
      invalidQRDesc: 'The QR code scanned is invalid or outdated. Please request assistance from staff.',
      closedTitle: 'Restaurant Closed',
      closedDesc: 'We are currently closed. Please check our opening hours in the about section.',
      notFoundTitle: 'Restaurant Not Found',
      notFoundDesc: 'The restaurant ID specified in the code does not exist in our systems.',
      disabledTitle: 'Table Unavailable',
      disabledDesc: 'This table is currently occupied or disabled. Contact restaurant staff for seating assistance.',
      networkTitle: 'Network Error',
      networkDesc: 'Failed to connect to the server. Please verify your internet connection and try again.',
      successTitle: 'Dining Session Activated!',
      successDesc: 'Your session has been securely registered to this table. Ready to experience our gourmet catalog.',
      continueMenu: 'Continue to Digital Menu',
      continueMenuSoon: 'Sprint 7.2 Coming Soon',
      sessionRestored: 'Active session restored!',
      workingHours: 'Working Hours',
      contactInfo: 'Contact Info',
      socialLinks: 'Follow Us'
    },
    es: {
      welcome: 'Bienvenido a',
      startDining: 'Comenzar a Cenar',
      aboutUs: 'Sobre el Restaurante',
      aboutDesc: 'Descubre nuestra historia, horarios y detalles.',
      openTill: 'Abierto hasta las',
      closed: 'Cerrado en este momento',
      prepTime: 'Tiempo prep. est.',
      seats: 'Asientos',
      status: 'Estado',
      available: 'Disponible',
      invalidQR: 'Código QR Inválido',
      invalidQRDesc: 'El código QR escaneado no es válido o está desactualizado. Solicite ayuda al personal.',
      closedTitle: 'Restaurante Cerrado',
      closedDesc: 'Actualmente estamos cerrados. Consulte nuestro horario en la sección sobre nosotros.',
      notFoundTitle: 'Restaurante No Encontrado',
      notFoundDesc: 'El ID del restaurante especificado no existe en nuestros sistemas.',
      disabledTitle: 'Mesa No Disponible',
      disabledDesc: 'Esta mesa está ocupada o deshabilitada. Póngase en contacto con el personal para obtener ayuda.',
      networkTitle: 'Error de Red',
      networkDesc: 'Error al conectar con el servidor. Verifique su conexión a Internet e inténtelo de nuevo.',
      successTitle: '¡Sesión de Cena Activada!',
      successDesc: 'Su sesión se ha registrado de forma segura en esta mesa. Listo para experimentar nuestro menú.',
      continueMenu: 'Continuar al Menú Digital',
      continueMenuSoon: 'Sprint 7.2 Muy Pronto',
      sessionRestored: '¡Sesión activa restaurada!',
      workingHours: 'Horas de Trabajo',
      contactInfo: 'Información de Contacto',
      socialLinks: 'Síguenos'
    },
    fr: {
      welcome: 'Bienvenue chez',
      startDining: 'Commencer à Dîner',
      aboutUs: 'À Propos du Restaurant',
      aboutDesc: 'Découvrez notre histoire, nos horaires et détails.',
      openTill: 'Ouvert jusqu\'à',
      closed: 'Fermé actuellement',
      prepTime: 'Temps de prép. est.',
      seats: 'Places',
      status: 'Statut',
      available: 'Disponible',
      invalidQR: 'Code QR Invalide',
      invalidQRDesc: 'Le code QR scanné est invalide ou obsolète. Veuillez demander l\'aide du personnel.',
      closedTitle: 'Restaurant Fermé',
      closedDesc: 'Nous sommes actuellement fermés. Veuillez vérifier nos horaires d\'ouverture.',
      notFoundTitle: 'Restaurant Non Trouvé',
      notFoundDesc: 'L\'identifiant du restaurant spécifié n\'existe pas dans notre système.',
      disabledTitle: 'Table Indisponible',
      disabledDesc: 'Cette table est occupée ou désactivée. Contactez le personnel pour obtenir de l\'aide.',
      networkTitle: 'Erreur Réseau',
      networkDesc: 'Échec de la connexion au serveur. Veuillez vérifier votre connexion Internet.',
      successTitle: 'Session de Repas Activée !',
      successDesc: 'Votre session a été enregistrée en toute sécurité à cette table. Prêt à découvrir notre menu.',
      continueMenu: 'Continuer vers le Menu',
      continueMenuSoon: 'Sprint 7.2 Bientôt Disponible',
      sessionRestored: 'Session active restaurée !',
      workingHours: 'Heures d\'Ouverture',
      contactInfo: 'Coordonnées',
      socialLinks: 'Suivez-nous'
    }
  };

  const t = translations[selectedLang] || translations.en;

  // 1. Live clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Generate/fetch device ID and validate QR on load
  useEffect(() => {
    // Generate persistent device ID if not present
    let savedDeviceId = localStorage.getItem('restaurantos_device_id');
    if (!savedDeviceId) {
      savedDeviceId = `DEV-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
      localStorage.setItem('restaurantos_device_id', savedDeviceId);
    }
    setDeviceId(savedDeviceId);

    const validateQR = async () => {
      setIsValidating(true);
      setErrorType(null);

      // Extract search params
      const r = searchParams.get('r') || searchParams.get('restaurantId') || '';
      const b = searchParams.get('b') || searchParams.get('branchId') || '';
      const t = searchParams.get('t') || searchParams.get('tableId') || '';
      const s = searchParams.get('s') || searchParams.get('secureToken') || '';

      const qrParams = { r, b, t, s };

      // Parse with Zod
      const parseResult = QrParamsSchema.safeParse(qrParams);
      if (!parseResult.success) {
        setErrorType('qr-invalid');
        setIsValidating(false);
        return;
      }

      // Check for cached active session
      const cachedSessionStr = sessionStorage.getItem('restaurantos_dining_session') || localStorage.getItem('restaurantos_dining_session');
      if (cachedSessionStr) {
        try {
          const cachedSession = JSON.parse(cachedSessionStr);
          if (
            cachedSession.restaurantId === r &&
            cachedSession.branchId === b &&
            cachedSession.tableId === t
          ) {
            // Check in background/restore
            setActiveSession(cachedSession);
          }
        } catch (e) {
          console.error('Failed to parse cached session', e);
        }
      }

      // Backend verification
      const res = await customerService.validateDiningSessionQR(qrParams) as any;
      if (!res.valid) {
        setErrorType(res.errorType);
        setRestaurant(res.restaurantData || null);
        setTable(res.tableData || null);
        setIsValidating(false);
        return;
      }

      setRestaurant(res.restaurant);
      setBranch(res.branch);
      setTable(res.table);
      setIsValidating(false);

      // Send event trigger
      await customerService.logCustomerEvent(r, 'QR Scanned', `QR Code verified for table ${t.replace('TBL-', '')}`, {
        restaurantId: r,
        branchId: b,
        tableId: t,
        deviceId: savedDeviceId
      });
    };

    validateQR();
  }, [searchParams]);

  // Apply branding color dynamically to document variables
  useEffect(() => {
    if (restaurant) {
      if (restaurant.primaryColor) {
        document.documentElement.style.setProperty('--color-primary', restaurant.primaryColor);
      } else {
        // Fallback default amber
        document.documentElement.style.setProperty('--color-primary', '35 92% 50%');
      }
      if (restaurant.secondaryColor) {
        document.documentElement.style.setProperty('--color-secondary', restaurant.secondaryColor);
      }
    }
  }, [restaurant]);

  // Handle Start Dining
  const handleStartDining = async () => {
    if (!restaurant || !branch || !table) return;

    try {
      setIsValidating(true);
      const session = await customerService.createDiningSession({
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableId: table.id,
        deviceId,
        language: selectedLang
      });

      setActiveSession(session);
      setSessionCreated(true);
      setIsValidating(false);
    } catch (e) {
      console.error(e);
      setErrorType('network-error');
      setIsValidating(false);
    }
  };

  // Render Loader screen
  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none antialiased">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-accent/10 blur-[100px]" />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-2xl relative">
            <span className="text-primary font-display font-extrabold text-3xl animate-pulse">S</span>
            <div className="absolute inset-0 border-2 border-primary/20 border-t-primary rounded-2xl animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-display font-extrabold uppercase tracking-widest text-slate-500">Spiral Dine</h2>
            <p className="text-xs text-mutedAsh animate-pulse">Establishing secure dining gateway...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render Error pages
  if (errorType) {
    const errorConfigs: Record<string, { icon: any; title: string; desc: string; color: string }> = {
      'restaurant-not-found': {
        icon: MapPin,
        title: t.notFoundTitle,
        desc: t.notFoundDesc,
        color: 'text-red-500 bg-red-500/10 border-red-500/20'
      },
      'restaurant-closed': {
        icon: Clock,
        title: t.closedTitle,
        desc: t.closedDesc,
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      },
      'qr-invalid': {
        icon: AlertTriangle,
        title: t.invalidQR,
        desc: t.invalidQRDesc,
        color: 'text-red-500 bg-red-500/10 border-red-500/20'
      },
      'table-disabled': {
        icon: Coffee,
        title: t.disabledTitle,
        desc: t.disabledDesc,
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      },
      'network-error': {
        icon: Wifi,
        title: t.networkTitle,
        desc: t.networkDesc,
        color: 'text-red-500 bg-red-500/10 border-red-500/20'
      }
    };

    const config = errorConfigs[errorType] || errorConfigs['qr-invalid'];
    const IconComponent = config.icon;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center select-none antialiased">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-[-15%] w-[450px] h-[450px] rounded-full bg-red-500/5 blur-[130px]" />
        </div>

        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border-slate-800/40 relative z-10 space-y-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${config.color}`}>
            <IconComponent className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-textPearl">{config.title}</h2>
            <p className="text-xs text-mutedAsh leading-relaxed">{config.desc}</p>
          </div>

          <div className="pt-2">
            <Button
              variant="secondary"
              className="w-full text-xs font-bold"
              onClick={() => window.location.reload()}
            >
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render Success/Activation Page (Sprint 7.1 limit)
  if (sessionCreated || activeSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center select-none antialiased">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[120px]" />
        </div>

        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border-slate-800/40 relative z-10 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-textPearl">
              {sessionCreated ? t.successTitle : t.sessionRestored}
            </h2>
            <p className="text-xs text-mutedAsh leading-relaxed">{t.successDesc}</p>
          </div>

          <Card className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl text-left space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Table</span>
              <strong className="text-textPearl font-bold">Table {table?.tableNumber || table?.number}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Capacity</span>
              <strong className="text-textPearl font-bold">{table?.capacity || table?.seatingCapacity} seats</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Session ID</span>
              <strong className="text-primary font-mono text-[10px] uppercase">{activeSession?.sessionId.substring(0, 15)}...</strong>
            </div>
          </Card>

          <div className="pt-2 space-y-3">
            <Button
              className="w-full text-xs font-bold flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700"
              onClick={() => navigate(`/customer/restaurant/${activeSession?.restaurantId || restaurant?.id}/menu`)}
            >
              <span>{t.continueMenu}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Welcome Screen
  const hours = restaurant?.businessHours || {};
  const isCurrentlyOpen = isRestaurantOpen(hours);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-left relative overflow-hidden select-none antialiased">
      {/* Background Graphic elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[5%] right-[-10%] w-[450px] h-[450px] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute bottom-[5%] left-[-15%] w-[400px] h-[400px] rounded-full bg-slate-900 blur-[120px]" />
      </div>

      {/* Dynamic Header Cover Image */}
      <div className="w-full h-52 md:h-64 relative overflow-hidden z-10 shrink-0">
        <img 
          src={restaurant?.coverImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=60'} 
          alt={restaurant?.restaurantName || 'Restaurant Cover'}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        
        {/* Dynamic header variables */}
        <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
          {/* Language selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 border border-slate-800/40 rounded-xl">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="bg-transparent text-slate-300 font-bold text-[10px] uppercase outline-none cursor-pointer border-none"
            >
              <option value="en" className="bg-slate-900">EN</option>
              <option value="es" className="bg-slate-900">ES</option>
              <option value="fr" className="bg-slate-900">FR</option>
            </select>
          </div>
        </div>

        {/* Live clock display */}
        <div className="absolute bottom-4 left-6 z-20 flex items-center space-x-2 bg-slate-950/45 backdrop-blur-sm px-3 py-1 rounded-xl border border-slate-800/20 text-slate-300 text-[11px] font-semibold">
          <Clock className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
          <span>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main Panel Content Card */}
      <main className="flex-1 w-full max-w-xl mx-auto px-6 pb-6 relative z-10 flex flex-col justify-between -mt-6">
        <div className="bg-slate-900/90 border border-slate-850/50 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6">
          
          {/* Brand header */}
          <div className="flex items-start space-x-4">
            {restaurant?.logoUrl ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-850 bg-slate-950 shrink-0 shadow-lg shadow-black/40">
                <img src={restaurant.logoUrl} alt={restaurant.restaurantName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary font-display font-extrabold text-3xl">S</span>
              </div>
            )}
            
            <div className="space-y-1">
              <h1 className="text-xl font-display font-extrabold text-textPearl">
                {restaurant?.restaurantName || restaurant?.name || 'Spiral Dine'}
              </h1>
              <p className="text-xs text-primary font-bold tracking-wider uppercase">
                {restaurant?.cuisine || 'Gourmet Cuisine'}
              </p>
            </div>
          </div>

          <p className="text-xs text-mutedAsh leading-relaxed font-medium">
            {restaurant?.description || 'Welcome to our restaurant! Use our digital assistant to view the menu, call the waiter, and place your order directly from this screen.'}
          </p>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                {t.prepTime}
              </span>
              <strong className="text-textPearl font-semibold text-xs">
                {restaurant?.waitingTime || '15-20 mins'}
              </strong>
            </div>
            
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                {t.status}
              </span>
              {isCurrentlyOpen ? (
                <Badge variant="success">
                  {t.openTill} {hours.closingTime || '22:00'}
                </Badge>
              ) : (
                <Badge variant="danger">{t.closed}</Badge>
              )}
            </div>
          </div>

          {/* Current Table Spot Card */}
          <Card className="bg-slate-950/60 border border-primary/25 shadow-xl shadow-primary/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[9.5px] font-bold text-primary uppercase tracking-widest">Table Connected</span>
              <h3 className="text-sm font-display font-extrabold text-textPearl">
                Welcome to Table {table?.tableNumber || table?.number}
              </h3>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Capacity</span>
                <span className="text-xs font-extrabold text-slate-300">
                  {table?.capacity || table?.seatingCapacity} {t.seats}
                </span>
              </div>
            </div>
          </Card>

          {/* Footer Interactive Actions */}
          <div className="space-y-3 pt-2">
            <Button
              className="w-full text-xs font-bold py-3.5 rounded-2xl flex items-center justify-center space-x-2 bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700 shadow-xl shadow-primary/10 transition-transform active:scale-[0.98]"
              onClick={handleStartDining}
              disabled={!isCurrentlyOpen}
            >
              <span>{t.startDining}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              className="w-full text-xs font-bold py-3 border-slate-800 hover:bg-slate-850 rounded-2xl text-slate-400 hover:text-textPearl"
              onClick={() => setIsAboutOpen(true)}
            >
              {t.aboutUs}
            </Button>
          </div>
        </div>
      </main>

      {/* Brand signature */}
      <footer className="w-full py-4 text-center text-[10px] text-slate-650 z-10 select-none">
        <span>Powered by Spiral Dine Core v1.2</span>
      </footer>

      {/* About Info Modal overlay */}
      <Modal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        title={restaurant?.restaurantName || 'About Us'}
      >
        <div className="space-y-5 text-left text-xs select-none">
          <div className="space-y-1.5">
            <h4 className="font-bold text-textPearl uppercase text-[10px] tracking-wider text-primary">
              Our Story
            </h4>
            <p className="text-slate-400 leading-relaxed">
              {restaurant?.description || 'Serving fresh culinary excellence daily using locally sourced ingredients, prepared by seasoned chefs.'}
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-850 pt-4">
            <h4 className="font-bold text-textPearl uppercase text-[10px] tracking-wider text-primary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.workingHours}</span>
            </h4>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Working Days</span>
                <span className="font-semibold text-slate-300">
                  {hours.workingDays?.join(', ') || 'Monday - Sunday'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Hours</span>
                <span className="font-semibold text-slate-300">
                  {hours.openingTime || '09:00'} - {hours.closingTime || '22:00'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-850 pt-4">
            <h4 className="font-bold text-textPearl uppercase text-[10px] tracking-wider text-primary flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{t.contactInfo}</span>
            </h4>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Phone</span>
                <span className="font-semibold text-slate-300">{restaurant?.phone || '+1 (555) 019-2831'}</span>
              </div>
              <div className="flex justify-between">
                <span>Address</span>
                <span className="font-semibold text-slate-300 text-right max-w-xs">{restaurant?.address || '123 Gourmet Ave, Gastronomy City'}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default CustomerWelcome;
