/**
 * Export tabular data as CSV file download
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const sanitizeCell = (cell: any): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(sanitizeCell).join(','),
    ...rows.map(row => row.map(sanitizeCell).join(','))
  ].join('\r\n');

  // Add UTF-8 BOM so Excel opens special characters correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export tabular data as Excel-compatible file (.xls XML table format)
 */
export function exportToExcel(filename: string, title: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const sanitizeXml = (str: any): string => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const headerRowXml = headers.map(h => `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${sanitizeXml(h)}</Data></Cell>`).join('');
  const dataRowsXml = rows.map(row => {
    const cells = row.map(val => {
      const isNum = typeof val === 'number' && !isNaN(val);
      const type = isNum ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${type}">${sanitizeXml(val)}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#12352D" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#12352D" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitizeXml(title.slice(0, 30))}">
  <Table>
   <Row ss:Height="25">
    <Cell ss:StyleID="TitleStyle"><Data ss:Type="String">${sanitizeXml(title)} - Exported on ${new Date().toLocaleDateString()}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    ${headerRowXml}
   </Row>
   ${dataRowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.xls') ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Print preview trigger for a formatted report
 */
export function printReportPreview(title: string, subtitle: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  const tableHeadersHtml = headers.map(h => `<th style="padding: 10px 12px; text-align: left; background: #12352D; color: #FFFFFF; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #C9533B;">${h}</th>`).join('');
  
  const tableRowsHtml = rows.map((row, idx) => {
    const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9F8F5';
    const cells = row.map(val => `<td style="padding: 8px 12px; font-size: 12px; color: #17202A; border-bottom: 1px solid #E5E7EB;">${val ?? '-'}</td>`).join('');
    return `<tr style="background: ${bg};">${cells}</tr>`;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - SpiralDine Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #17202A; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #12352D; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 20px; font-weight: 800; color: #12352D; }
          .brand span { color: #C9533B; }
          .meta { font-size: 12px; color: #6B7280; text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .footer { margin-top: 30px; font-size: 11px; color: #9CA3AF; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 10px; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Spiral<span>Dine</span> Owner Business Report</div>
            <h1 style="font-size: 18px; margin: 6px 0 2px 0;">${title}</h1>
            <div style="font-size: 12px; color: #6B7280;">${subtitle}</div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Records:</strong> ${rows.length} rows</div>
          </div>
        </div>
        <table>
          <thead><tr>${tableHeadersHtml}</tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
        <div class="footer">
          SpiralDine Executive Management System &middot; Confidential Business Record
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}
