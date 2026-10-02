// Admin stylesheets, loaded with the main bundle even though the admin code is lazy-loaded.
//
// Public pages currently rely on some rules that live only in these files (shared utility
// classes such as .text-emerald, .text-accent, .icon-emerald, .form-row-2). Keeping every file
// here, in the same order the admin import graph used to add them, leaves the cascade for
// both the public site and the console exactly as it was. Move those shared rules into the
// public styles before dropping any file from this list.
import './AdminLayout.css';
import './pages/OperationsCenter.css';
import './pages/QuoteRequestsView.css';
import './components/EditShipmentModal.css';
import './components/DeleteShipmentModal.css';
import './components/RecentlyDeletedModal.css';
import './pages/AllShipmentsView.css';
import './pages/CreateShipmentView.css';
import './pages/TrackingEventsView.css';
import './pages/DocumentCenterView.css';
import './pages/SettingsView.css';
import './pages/MessagesView.css';
import './components/ShipmentControlModal.css';
import './AdminLogin.css';
