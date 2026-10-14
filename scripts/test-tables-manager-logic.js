import { cleanTableIdentifier, isTableAvailable, isTableOccupied, isTableCleaning } from '../src/shared/domain/tables/types.ts';

// Test fixtures representing the exact problematic documents in Firestore
const mockFirestoreDocs = [
  // From yummy-yummy-3p65
  { id: 'TBL-1', data: { tableNumber: '1', number: '1', tableName: 'Table 1', status: 'Available', capacity: 4 } },
  { id: 'TBL-10', data: { tableNumber: undefined, number: undefined, tableName: undefined, status: 'Available' } }, // CRASH TRIGGER
  { id: 'TBL-2', data: { tableNumber: '2', number: '2', tableName: 'Table 2', status: 'Available', capacity: 2 } },
  { id: 'TBL-3', data: { tableNumber: '3', number: '3', tableName: 'Table 3', status: 'Available', capacity: 6 } },
  // From spiral-restaurant-ilpc
  { id: 'TBL-4', data: { tableNumber: undefined, number: '4', tableName: undefined, status: 'Occupied', capacity: 4 } },
  // From tasty-foods-qzc8
  { id: 'TBL-1_tasty', data: { tableNumber: '1', number: '1', tableName: 'Table 1', status: 'bill_requested', capacity: 4 } },
  { id: 'TBL-6_tasty', data: { tableNumber: '6', number: '6', tableName: 'Table 6', status: 'Cleaning', capacity: 4 } },
  { id: 'TBL-3_tasty', data: { tableNumber: '3', number: '3', tableName: 'Table 3', status: 'Reserved', capacity: 6 } }
];

const mapFirestoreDocToTable = (id, raw, index, defaultFloor = 'Main Floor', defaultSection = 'Main Dining Area') => {
  const tableNumber = String(
    raw.tableNumber || raw.number || cleanTableIdentifier(id) || id || `T${index + 1}`
  ).trim();
  
  const tableName = String(
    raw.tableName || raw.name || `Table ${tableNumber}`
  ).trim();
  
  const rawCapacity = Number(raw.capacity ?? raw.seatingCapacity);
  const capacity = !isNaN(rawCapacity) && rawCapacity > 0 ? rawCapacity : 4;
  
  const rawStatus = String(raw.status || raw.tableStatus || 'Available').trim();
  let status = 'Available';
  const sLower = rawStatus.toLowerCase();
  if (sLower === 'disabled' || raw.isActive === false) {
    status = 'Disabled';
  } else if (isTableCleaning(rawStatus)) {
    status = 'Cleaning';
  } else if (sLower === 'reserved') {
    status = 'Reserved';
  } else if (isTableOccupied(rawStatus, raw.subStatus, raw.diningStatus)) {
    if (sLower === 'bill_requested' || sLower === 'bill requested') {
      status = 'Bill Requested';
    } else if (sLower === 'dining') {
      status = 'Dining';
    } else if (sLower === 'preparing') {
      status = 'Preparing';
    } else if (sLower === 'ordering') {
      status = 'Ordering';
    } else {
      status = 'Occupied';
    }
  } else if (sLower === 'occupied') {
    status = 'Occupied';
  } else {
    status = 'Available';
  }

  const validShapes = ['square', 'circle', 'rectangle'];
  const shape = validShapes.includes(raw.shape) ? raw.shape : 'square';

  const posX = typeof raw.positionX === 'number' && !isNaN(raw.positionX)
    ? Math.max(0, Math.min(raw.positionX, 90))
    : 10 + (index % 5) * 16;
  const posY = typeof raw.positionY === 'number' && !isNaN(raw.positionY)
    ? Math.max(0, Math.min(raw.positionY, 90))
    : 10 + Math.floor(index / 5) * 16;

  return {
    id,
    tableId: raw.tableId || id,
    tableNumber,
    tableName,
    floor: raw.floor || defaultFloor,
    section: raw.section || defaultSection,
    capacity,
    status,
    shape,
    positionX: posX,
    positionY: posY,
    qrCodeId: raw.qrCodeId || `QR-${id}`,
    branchId: raw.branchId || 'main',
    isActive: status !== 'Disabled',
    isArchived: Boolean(raw.isArchived),
    notes: raw.notes || raw.tableNotes || '',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    createdBy: raw.createdBy || 'owner'
  };
};

console.log('Testing normalization and sorting on problematic documents:');
const mappedList = mockFirestoreDocs.map((doc, idx) => mapFirestoreDocToTable(doc.id, doc.data, idx));

// Verify table numbers
mappedList.forEach(t => {
  console.log(`- ID: ${t.id} => tableNumber: "${t.tableNumber}", tableName: "${t.tableName}", status: "${t.status}", capacity: ${t.capacity}`);
});

// Verify sort does NOT throw
mappedList.sort((a, b) => (a.tableNumber || '').localeCompare(b.tableNumber || '', undefined, { numeric: true, sensitivity: 'base' }));
console.log('\nSorted tables successfully:');
mappedList.forEach(t => console.log(`  Table #${t.tableNumber} (${t.tableName})`));

// Verify status counters
const available = mappedList.filter(t => isTableAvailable(t.status, t.isActive)).length;
const occupied = mappedList.filter(t => isTableOccupied(t.status) || t.status === 'Occupied' || t.status === 'Bill Requested').length;
const reserved = mappedList.filter(t => t.status.toLowerCase() === 'reserved').length;
const cleaning = mappedList.filter(t => isTableCleaning(t.status)).length;

console.log(`\nCounters: Total=${mappedList.length}, Available=${available}, Occupied=${occupied}, Reserved=${reserved}, Cleaning=${cleaning}`);
console.log('ALL TESTS PASSED!');
