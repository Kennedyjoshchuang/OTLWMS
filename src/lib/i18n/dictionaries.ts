export type Language = "en" | "id";

export const dictionaries = {
  en: {
    // Layout / Navigation
    "nav.dashboard": "Dashboard",
    "nav.inbound": "Inbound (GRN)",
    "nav.outbound": "Outbound",
    "nav.deliveries": "Deliveries",
    "nav.employees": "Employees",
    "nav.analytics": "Analytics",
    "nav.kpi": "KPI",
    "nav.settings": "Settings",
    "nav.logout": "Log Out",
    "nav.owner": "Owner Page",
    "nav.products": "Products",
    "nav.warehouse_map": "Warehouse Map",
    "nav.pick_lists": "Pick Lists",
    "nav.billing": "Billing & Invoices",
    
    // Analytics
    "analytics.title": "Analytics Dashboard",
    "analytics.subtitle": "Monitor operational performance and KPI trends over time.",
    "analytics.period.daily": "daily",
    "analytics.period.weekly": "weekly",
    "analytics.period.monthly": "monthly",
    "analytics.period.yearly": "yearly",
    "analytics.period.custom": "custom",
    "analytics.export_pdf": "Export to PDF",
    "analytics.export_excel": "Export to Excel",
    "analytics.export_modal_title": "Customize Excel Export",
    "analytics.export_modal_desc": "Select which tables/reports you want to include in the exported Excel spreadsheet.",
    "analytics.export_btn": "Export",
    "analytics.cancel_btn": "Cancel",
    "analytics.select_all": "Select All",
    "analytics.clear_all": "Clear All",
    "analytics.sections.inbound": "Inbound Product Summary",
    "analytics.sections.outbound_products": "Outbound Product Summary",
    "analytics.sections.stock": "Warehouse Stock Report",
    "analytics.sections.delivered": "Delivered Orders Report",
    "analytics.sections.pending": "Pending Orders Report",
    
    // KPIs
    "kpi.inbound": "Inbound",
    "kpi.outbound": "Outbound",
    "kpi.warehouse_stock": "Warehouse Stock",
    "kpi.delivered_customer": "Delivered Customer",
    "kpi.pending_delivery": "Pending Delivery",
    "kpi.accident": "Accident",
    
    // Charts
    "chart.title": "Inbound vs Outbound Trend (Liters)",
    
    // Tables
    "table.inbound_summary": "Inbound Product Summary (By Date Range)",
    "table.outbound_summary": "Outbound Product Summary (By Date Range)",
    "table.stock_summary": "Total Warehouse Stock Report (Snapshot)",
    "table.delivered_orders": "Delivered Orders Report",
    "table.pending_orders": "Pending Orders Report",
    
    "table.col.product_code": "Product Code",
    "table.col.product_name": "Product Name",
    "table.col.location": "Location",
    "table.col.total_pcs": "Total PCS",
    "table.col.stock_pcs": "Stock (PCS)",
    "table.col.total_volume": "Total Volume (L)",
    "table.col.volume": "Volume (L)",
    "table.col.do_number": "DO Number",
    "table.col.customer": "Customer",
    "table.col.destination": "Destination",
    "table.col.date": "Date",
    "table.col.status": "Status",
    "table.col.created": "Created",
    
    "table.empty.inbound": "No inbound records found.",
    "table.empty.outbound_prod": "No outbound product records found.",
    "table.empty.stock": "No stock found in the warehouse.",
    "table.empty.delivered": "No delivered orders found.",
    "table.empty.pending": "No pending orders found."
  },
  id: {
    // Layout / Navigation
    "nav.dashboard": "Beranda",
    "nav.inbound": "Inbound (GRN)",
    "nav.outbound": "Outbound",
    "nav.deliveries": "Pengiriman",
    "nav.employees": "Karyawan",
    "nav.analytics": "Analitik",
    "nav.kpi": "KPI",
    "nav.settings": "Pengaturan",
    "nav.logout": "Keluar",
    "nav.owner": "Halaman Owner",
    "nav.products": "Produk",
    "nav.warehouse_map": "Peta Gudang",
    "nav.pick_lists": "Pick Lists",
    "nav.billing": "Tagihan & Faktur",
    
    // Analytics
    "analytics.title": "Dasbor Analitik",
    "analytics.subtitle": "Pantau kinerja operasional dan tren KPI dari waktu ke waktu.",
    "analytics.period.daily": "harian",
    "analytics.period.weekly": "mingguan",
    "analytics.period.monthly": "bulanan",
    "analytics.period.yearly": "tahunan",
    "analytics.period.custom": "kustom",
    "analytics.export_pdf": "Ekspor ke PDF",
    "analytics.export_excel": "Ekspor ke Excel",
    "analytics.export_modal_title": "Kustomisasi Ekspor Excel",
    "analytics.export_modal_desc": "Pilih tabel/laporan mana yang ingin Anda masukkan ke dalam spreadsheet Excel yang diekspor.",
    "analytics.export_btn": "Ekspor",
    "analytics.cancel_btn": "Batal",
    "analytics.select_all": "Pilih Semua",
    "analytics.clear_all": "Bersihkan Semua",
    "analytics.sections.inbound": "Ringkasan Produk Inbound",
    "analytics.sections.outbound_products": "Ringkasan Produk Outbound",
    "analytics.sections.stock": "Laporan Stok Gudang",
    "analytics.sections.delivered": "Laporan Pesanan Terkirim",
    "analytics.sections.pending": "Laporan Pesanan Tertunda",
    
    // KPIs
    "kpi.inbound": "Inbound",
    "kpi.outbound": "Outbound",
    "kpi.warehouse_stock": "Stok Gudang",
    "kpi.delivered_customer": "Pelanggan Terkirim",
    "kpi.pending_delivery": "Pengiriman Tertunda",
    "kpi.accident": "Kecelakaan",
    
    // Charts
    "chart.title": "Tren Inbound vs Outbound (Liter)",
    
    // Tables
    "table.inbound_summary": "Ringkasan Produk Inbound (Berdasarkan Rentang Tanggal)",
    "table.outbound_summary": "Ringkasan Produk Outbound (Berdasarkan Rentang Tanggal)",
    "table.stock_summary": "Laporan Total Stok Gudang (Cuplikan Saat Ini)",
    "table.delivered_orders": "Laporan Pesanan Terkirim",
    "table.pending_orders": "Laporan Pesanan Tertunda",
    
    "table.col.product_code": "Kode Produk",
    "table.col.product_name": "Nama Produk",
    "table.col.location": "Lokasi",
    "table.col.total_pcs": "Total PCS",
    "table.col.stock_pcs": "Stok (PCS)",
    "table.col.total_volume": "Total Volume (L)",
    "table.col.volume": "Volume (L)",
    "table.col.do_number": "Nomor DO",
    "table.col.customer": "Pelanggan",
    "table.col.destination": "Tujuan",
    "table.col.date": "Tanggal",
    "table.col.status": "Status",
    "table.col.created": "Dibuat",
    
    "table.empty.inbound": "Tidak ada catatan inbound yang ditemukan.",
    "table.empty.outbound_prod": "Tidak ada catatan produk outbound yang ditemukan.",
    "table.empty.stock": "Tidak ada stok yang ditemukan di gudang.",
    "table.empty.delivered": "Tidak ada pesanan terkirim yang ditemukan.",
    "table.empty.pending": "Tidak ada pesanan tertunda yang ditemukan."
  }
};

export type DictionaryKey = keyof typeof dictionaries.en;
