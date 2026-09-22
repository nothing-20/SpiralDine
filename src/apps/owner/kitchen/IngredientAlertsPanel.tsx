import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card/Card';
import { AlertTriangle, Check, X, ShoppingCart, Package } from 'lucide-react';

interface IIngredientAlertsPanelProps {
  menuItems: any[];
}

const IngredientAlertsPanel: React.FC<IIngredientAlertsPanelProps> = ({ menuItems }) => {
  const alerts = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      currentStock: number;
      minStock: number;
      unit: string;
      status: 'healthy' | 'low' | 'out';
      portionsRemaining: number;
    }> = [];

    menuItems.forEach(item => {
      // Check for batch items with low portions
      const isBatch = item.preparationMethod === 'batch' || item.productionMode === 'Batch Production';
      if (isBatch) {
        const available = item.availableServings ?? 0;
        const defaultBatch = item.defaultBatchSize ?? 50;
        const pct = defaultBatch > 0 ? (available / defaultBatch) * 100 : 100;

        let status: 'healthy' | 'low' | 'out' = 'healthy';
        if (available === 0) status = 'out';
        else if (pct < 20) status = 'low';

        if (status !== 'healthy') {
          items.push({
            id: item.id,
            name: item.name,
            currentStock: available,
            minStock: Math.ceil(defaultBatch * 0.2),
            unit: 'portions',
            status,
            portionsRemaining: available,
          });
        }
      }
    });

    return items.sort((a, b) => {
      const order = { out: 0, low: 1, healthy: 2 };
      return order[a.status] - order[b.status];
    });
  }, [menuItems]);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
        <Check className="w-3.5 h-3.5" />
        <span>All ingredients healthy — no alerts</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-textPearl flex items-center space-x-1.5">
          <Package className="w-3.5 h-3.5 text-orange-400" />
          <span>Ingredient Alerts</span>
          <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </h3>
        <Link
          to="/dashboard/kitchen/inventory"
          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline transition-colors"
        >
          View All Stock →
        </Link>
      </div>

      <div className="space-y-1.5">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[10px] ${
              alert.status === 'out'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              {alert.status === 'out' ? <X className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              <span className="font-bold">{alert.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-extrabold">
                {alert.currentStock} {alert.unit}
              </span>
              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                alert.status === 'out'
                  ? 'bg-red-500/20 border-red-500/30 text-red-300'
                  : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
              }`}>
                {alert.status === 'out' ? 'OUT OF STOCK' : 'LOW STOCK'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IngredientAlertsPanel;
