PRAGMA foreign_keys = OFF;

DELETE FROM "DOPickingItem";
DELETE FROM "InvoiceItem";
DELETE FROM "Invoice";
DELETE FROM "StockMovement";
DELETE FROM "StockLedger";
DELETE FROM "DeliveryOrder";
DELETE FROM "DeliveryTicketItem";
DELETE FROM "DeliveryTicket";
DELETE FROM "InboundReceipt";
DELETE FROM "PackingListItem";
DELETE FROM "PackingList";
DELETE FROM "DeleteRequest";
DELETE FROM "Incident";
DELETE FROM "PricingRate";
DELETE FROM "Product";
DELETE FROM "PalletPosition";
DELETE FROM "WarehouseRack";
DELETE FROM "Customer";
DELETE FROM "User";

PRAGMA foreign_keys = ON;
