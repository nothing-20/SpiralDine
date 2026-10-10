import { IKitchenTicket } from '../domain/orders/types';
import { kotService } from './kotService';

export interface IKotPrintResult {
  success: boolean;
  error?: string;
  isReprint?: boolean;
}

export const kotPrintService = {
  /**
   * Generates clean thermal-printer-compatible HTML layout (80mm / 58mm width).
   */
  generateKotThermalHtml(
    ticket: IKitchenTicket,
    restaurantName: string = 'SpiralDine Restaurant',
    isReprint: boolean = false
  ): string {
    const isReprintMode = isReprint || (ticket.printCount || 0) > 0;
    const reprintLabel = isReprintMode
      ? `<div class="reprint-banner">*** DUPLICATE / REPRINT #${(ticket.printCount || 0) + 1} ***</div>`
      : '';

    const roundBadge = ticket.isSupplementary
      ? `<div class="round-badge">SUPPLEMENTARY KOT (ROUND #${ticket.round || 2})</div>`
      : `<div class="round-badge-initial">INITIAL ORDER (ROUND #1)</div>`;

    const formattedTime = new Date(ticket.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const formattedDate = new Date(ticket.createdAt).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const itemsHtml = ticket.items.map((item, idx) => `
      <div class="item-row">
        <div class="item-left">
          <span class="item-num">${idx + 1}.</span>
          <span class="item-name ${item.isVeg ? 'item-veg' : 'item-nonveg'}">
            ${item.isVeg ? '[V]' : '[NV]'} ${item.name}
          </span>
          ${item.notes ? `<div class="item-notes">MOD: "${item.notes}"</div>` : ''}
          ${item.station ? `<div class="item-station">Station: ${item.station}</div>` : ''}
        </div>
        <div class="item-qty">x${item.count}</div>
      </div>
    `).join('');

    const specialInstructionsHtml = ticket.specialInstructions ? `
      <div class="special-instructions-box">
        <strong>SPECIAL INSTRUCTIONS:</strong><br/>
        ${ticket.specialInstructions}
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${ticket.ticketNumber} - Table ${ticket.tableNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            font-size: 13px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            padding: 6px;
            width: 76mm;
            max-width: 100%;
            margin: 0 auto;
          }
          .reprint-banner {
            border: 2px dashed #000;
            text-align: center;
            font-weight: 900;
            font-size: 14px;
            padding: 4px;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .restaurant-name {
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-title {
            font-size: 18px;
            font-weight: 900;
            margin-top: 3px;
            letter-spacing: 1px;
          }
          .round-badge, .round-badge-initial {
            display: inline-block;
            margin-top: 4px;
            padding: 2px 6px;
            font-weight: 900;
            font-size: 11px;
            border: 1px solid #000;
            text-transform: uppercase;
          }
          .meta-grid {
            margin: 8px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
            font-size: 12px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .meta-label {
            font-weight: 700;
          }
          .table-highlight {
            font-size: 18px;
            font-weight: 900;
            text-align: center;
            padding: 4px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            margin: 6px 0;
            text-transform: uppercase;
          }
          .items-header {
            display: flex;
            justify-content: space-between;
            font-weight: 900;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
            margin-bottom: 5px;
            font-size: 12px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 7px;
            padding-bottom: 4px;
            border-bottom: 1px dotted #ccc;
          }
          .item-left {
            flex: 1;
            padding-right: 8px;
          }
          .item-num {
            font-weight: 700;
            margin-right: 3px;
          }
          .item-name {
            font-weight: 800;
            font-size: 14px;
          }
          .item-notes {
            font-size: 11px;
            font-style: italic;
            margin-top: 2px;
            padding: 2px 4px;
            background: #eee;
            border-left: 2px solid #000;
          }
          .item-station {
            font-size: 10px;
            color: #444;
            margin-top: 1px;
          }
          .item-qty {
            font-size: 16px;
            font-weight: 900;
            min-width: 32px;
            text-align: right;
          }
          .special-instructions-box {
            margin-top: 8px;
            padding: 5px;
            border: 1px solid #000;
            font-size: 11px;
          }
          .footer {
            margin-top: 12px;
            border-top: 1px dashed #000;
            padding-top: 6px;
            text-align: center;
            font-size: 10px;
          }
          @media print {
            body {
              padding: 0;
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        ${reprintLabel}
        <div class="header">
          <div class="restaurant-name">${restaurantName}</div>
          <div class="doc-title">${ticket.ticketNumber}</div>
          ${roundBadge}
        </div>

        <div class="table-highlight">
          TABLE: ${ticket.tableNumber}
        </div>

        <div class="meta-grid">
          <div class="meta-row">
            <span class="meta-label">Date & Time:</span>
            <span>${formattedDate} ${formattedTime}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Order Ref:</span>
            <span>#${ticket.orderId.substring(0, 10)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Primary Station:</span>
            <span>${ticket.station}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Diner / Server:</span>
            <span>${ticket.waiterName || ticket.customerName || 'Dine-In'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Source:</span>
            <span>${ticket.source.toUpperCase()}</span>
          </div>
        </div>

        <div class="items-header">
          <span>ITEM / MODIFICATIONS</span>
          <span>QTY</span>
        </div>

        <div class="items-list">
          ${itemsHtml}
        </div>

        ${specialInstructionsHtml}

        <div class="footer">
          <div>TOTAL ITEMS ORDERED: ${ticket.items.reduce((acc, i) => acc + (i.count || 1), 0)}</div>
          <div>Printed at: ${new Date().toLocaleTimeString()}</div>
          <div style="margin-top: 4px; font-weight: bold;">SpiralDine KOT Engine</div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Dispatches the KOT to the connected printer via the browser's standard print subsystem.
   * Handles popup blockers, preserves the digital record, and tracks print outcomes and reprints.
   */
  async printTicket(
    tenantId: string,
    ticket: IKitchenTicket,
    restaurantName: string = 'SpiralDine Restaurant',
    actor?: { uid?: string; displayName?: string },
    isReprint: boolean = false
  ): Promise<IKotPrintResult> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Printing is only supported in browser environments.' };
    }

    const html = kotPrintService.generateKotThermalHtml(ticket, restaurantName, isReprint);
    const printWindow = window.open('', '_blank', 'width=450,height=700');

    if (!printWindow) {
      const errorMsg = 'Browser popup blocker prevented print window from opening. Please allow popups for SpiralDine.';
      await kotService.recordPrintAttempt(tenantId, ticket.id, false, errorMsg, actor);
      return { success: false, error: errorMsg };
    }

    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      // Trigger native print dialog safely
      setTimeout(async () => {
        try {
          printWindow.print();
        } catch (_) {}
      }, 250);

      // Record successful print outcome / reprint log in Firestore
      if (isReprint) {
        await kotService.recordReprint(tenantId, ticket.id, actor, 'Manual kitchen reprint');
      } else {
        await kotService.recordPrintAttempt(tenantId, ticket.id, true, undefined, actor);
      }

      return { success: true, isReprint };
    } catch (err: any) {
      console.error('[kotPrintService] Print exception:', err);
      const errMsg = err?.message || 'Print subsystem error';
      await kotService.recordPrintAttempt(tenantId, ticket.id, false, errMsg, actor);
      return { success: false, error: errMsg };
    }
  }
};

export default kotPrintService;
