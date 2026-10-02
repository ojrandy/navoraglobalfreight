import React, { useCallback, useEffect, useState } from 'react';
import { AdminLayout, AdminViewType } from './AdminLayout';
import { OperationsCenter } from './pages/OperationsCenter';
import { QuoteRequestsView } from './pages/QuoteRequestsView';
import { AllShipmentsView } from './pages/AllShipmentsView';
import { CreateShipmentView } from './pages/CreateShipmentView';
import { TrackingEventsView } from './pages/TrackingEventsView';
import { DocumentCenterView } from './pages/DocumentCenterView';
import { SettingsView } from './pages/SettingsView';
import { MessagesView } from './pages/MessagesView';
import { api } from '../services/api';
import type { ContactMessage } from '../types/admin';
import { ShipmentControlModal } from './components/ShipmentControlModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Shipment, ShipmentStatus } from '../types/shipment';
import { useAdminData } from '../context/AdminDataContext';
import {
  Radio,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Eye,
  FileCheck,
  Package,
  Layers
} from 'lucide-react';

interface AdminAppProps {
  onNavigatePublic: (page: string) => void;
  onViewPublicTracking: (trackingNumber: string) => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ onNavigatePublic, onViewPublicTracking }) => {
  const { shipments, updateShipmentStatus, updateShipmentDirect } = useAdminData();
  const [currentView, setCurrentView] = useState<AdminViewType>('operations-center');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  // Sidebar badge for unread Contact page messages, refreshed every minute.
  const handleMessagesChanged = useCallback((messages: ContactMessage[]) => {
    setNewMessagesCount(messages.filter((m) => m.status === 'NEW').length);
  }, []);
  useEffect(() => {
    const refresh = () => api.getContactMessages().then(handleMessagesChanged).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [handleMessagesChanged]);

  // 1-Click Operations Control Modal State — tracked by trackingNumber (not a frozen
  // snapshot) so the modal always reflects live progress/speed as the simulation ticks.
  const [controlModalTrackingNumber, setControlModalTrackingNumber] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  const controlModalShipment = controlModalTrackingNumber
    ? shipments.find(s => s.trackingNumber === controlModalTrackingNumber) || null
    : null;

  const handleQuickUpdateStatus = (shipment: Shipment) => {
    setControlModalTrackingNumber(shipment.trackingNumber);
  };

  // Live simulation ticks (play/pause/speed/scrub) — local state only. These fire every
  // 500ms while simulating, so they must NOT hit the backend or they'd write a new
  // permanent tracking-event row on every tick.
  const handleLiveSimUpdate = (updated: Shipment) => {
    updateShipmentDirect(updated);
  };

  // Deliberate status-change submissions ("Update Status" button) — these should persist.
  const handleShipmentUpdatedFromControl = (updated: Shipment) => {
    // 1. Direct local state update to preserve all delayNotice, simulation, POD, docs & timeline
    updateShipmentDirect(updated);

    const loc = typeof updated.currentLocation === 'string'
      ? updated.currentLocation
      : `${(updated.currentLocation as any)?.city || updated.origin?.city || 'Transit Hub'}, ${(updated.currentLocation as any)?.state || updated.origin?.state || ''}`;
    const fac = updated.currentFacility || (typeof updated.currentLocation === 'object' ? (updated.currentLocation as any)?.facility : 'Gateway Hub') || 'Gateway Hub';
    // Real coordinates for wherever the control modal just set the shipment to (At Facility,
    // Out for Delivery, Delivered) — without forwarding these the server has no way to know
    // the shipment moved and silently keeps whatever coordinates were stored at creation.
    const lat = typeof updated.currentLocation === 'object' ? (updated.currentLocation as any)?.lat : undefined;
    const lng = typeof updated.currentLocation === 'object' ? (updated.currentLocation as any)?.lng : undefined;

    // ShipmentControlModal already built a specific, action-worded event (e.g. "Physical
    // checkpoint scan confirmed at Rocky Mountain Gateway") and prepended it to
    // updated.timeline before calling us — updateShipmentDirect above already committed that
    // to local state. Without passing it through here too, the call below used to fall back
    // to the generic statusText for both the event's title AND description, so the specific
    // wording never reached the server at all and got silently buried locally by a second,
    // duplicate "Status: X" event on top of it.
    const richEvent = updated.timeline && updated.timeline[0];

    // 2. Sync status transition to backend — pass the progress/statusText planningEngine.ts
    // already computed (hold/delay reason, frozen progress, etc.) so the server persists the
    // real values instead of falling back to its generic per-status defaults. Also forwards
    // the pushed-back ETA a Hold/Delay computes (estimatedDelivery/estimatedDeliveryDetail) —
    // without this the extended ETA only ever lived in this browser's local state and got
    // silently wiped by the next refresh, and never reached the public tracking page at all.
    updateShipmentStatus(
      updated.trackingNumber,
      updated.status,
      loc,
      fac,
      richEvent?.description || updated.statusText,
      updated.progressPercent,
      updated.statusText,
      lat,
      lng,
      richEvent?.title,
      true, // skipLocalEventDuplicate — updateShipmentDirect already added the real event locally
      undefined,
      updated.estimatedDelivery,
      updated.estimatedDeliveryDetail
    ).then((result) => {
      setToastIsError(!result.success);
      setToastMessage(result.success
        ? `Shipment ${updated.trackingNumber} updated: ${updated.statusText}`
        : `Failed to save the update for ${updated.trackingNumber}: ${result.error || 'server rejected the request'}. Reverted.`);
      setTimeout(() => setToastMessage(null), 6000);
    });
  };

  const handleOpenShipmentDetail = (trackingNumber: string) => {
    onViewPublicTracking(trackingNumber);
  };

  return (
    <AdminLayout
      currentView={currentView}
      onSelectView={setCurrentView}
      onNavigatePublic={onNavigatePublic}
      searchQuery={globalSearch}
      onSearchChange={setGlobalSearch}
      newMessagesCount={newMessagesCount}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`admin-toast-success animate-fade-in${toastIsError ? ' toast-error' : ''}`}>
          {toastIsError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Keyed by currentView so a crash in one view can't stay stuck once the admin navigates away */}
      <ErrorBoundary key={currentView} label="This section">
        {/* OPERATIONS CENTER OVERVIEW */}
        {currentView === 'operations-center' && (
          <OperationsCenter
            onSelectView={setCurrentView}
            onOpenShipmentDetail={handleOpenShipmentDetail}
            onQuickUpdateStatus={handleQuickUpdateStatus}
          />
        )}

        {/* ALL SHIPMENTS */}
        {currentView === 'all-shipments' && (
          <AllShipmentsView
            onOpenShipmentDetail={handleOpenShipmentDetail}
            onQuickUpdateStatus={handleQuickUpdateStatus}
          />
        )}

        {/* CREATE MASTER CONSIGNMENT */}
        {currentView === 'create-shipment' && (
          <CreateShipmentView
            onSelectView={setCurrentView}
            onOpenShipmentDetail={handleOpenShipmentDetail}
          />
        )}

        {/* QUOTE REQUESTS */}
        {currentView === 'quote-requests' && (
          <QuoteRequestsView />
        )}

        {/* CONTACT PAGE MESSAGES */}
        {currentView === 'messages' && (
          <MessagesView searchQuery={globalSearch} onMessagesChanged={handleMessagesChanged} />
        )}

        {/* TRACKING EVENTS & SCANNER */}
        {currentView === 'tracking-events' && (
          <TrackingEventsView onSelectView={setCurrentView} />
        )}

        {/* DOCUMENT CENTER */}
        {currentView === 'document-center' && (
          <DocumentCenterView
            onOpenShipmentDetail={handleOpenShipmentDetail}
            onSelectView={setCurrentView}
          />
        )}

        {/* SETTINGS */}
        {currentView === 'settings' && (
          <SettingsView />
        )}
      </ErrorBoundary>

      {/* 1-CLICK OPERATIONS CONTROL MODAL */}
      {controlModalShipment && (
        <ShipmentControlModal
          shipment={controlModalShipment}
          onClose={() => setControlModalTrackingNumber(null)}
          onUpdateShipment={handleShipmentUpdatedFromControl}
          onLiveUpdate={handleLiveSimUpdate}
        />
      )}
    </AdminLayout>
  );
};
