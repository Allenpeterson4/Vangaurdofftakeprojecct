'use client';

import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/portal-api';
import type { Batch, ManagerProfile, Supplier } from '@/lib/types';
import { statusLabel } from '@/lib/format';

function ActionFeedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return <p role={error ? 'alert' : 'status'} className={`mt-3 rounded-lg p-2.5 text-xs ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{error ?? success}</p>;
}

function useActionFeedback() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return {
    pending,
    error,
    success,
    async run(action: () => Promise<unknown>, onSaved?: () => void) {
      setPending(true);
      setError('');
      setSuccess('');
      try {
        const result = await action();
        const notification = typeof result === 'object' && result !== null && 'notification' in result
          ? result.notification
          : null;
        setSuccess(notification === 'sent'
          ? 'Saved successfully. Telegram notification sent.'
          : notification === 'failed'
            ? 'Saved successfully, but the Telegram notification could not be sent.'
            : 'Saved successfully.');
        onSaved?.();
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The request could not be completed.');
        return false;
      } finally {
        setPending(false);
      }
    },
  };
}

export function SupplierForm({ onSaved }: { onSaved: () => void }) {
  const feedback = useActionFeedback();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await feedback.run(() => apiRequest('offtake.php?action=create_supplier', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        contact_person: form.get('contact_person'),
        phone: form.get('phone'),
      }),
    }), onSaved);
    if (saved) formElement.reset();
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <input className="field" name="name" placeholder="Company / factory name" minLength={2} maxLength={160} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="field" name="contact_person" placeholder="Contact person" maxLength={160} />
        <input className="field" name="phone" placeholder="Phone number" maxLength={40} />
      </div>
      <button className="button-primary" disabled={feedback.pending}>{feedback.pending ? 'Creating…' : 'Add company'}</button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </form>
  );
}

export function AssignManagerForm({ manager, suppliers, onSaved }: { manager: ManagerProfile; suppliers: Supplier[]; onSaved: () => void }) {
  const feedback = useActionFeedback();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await feedback.run(() => apiRequest('offtake.php?action=assign_manager', {
      method: 'POST',
      body: JSON.stringify({ user_id: manager.id, supplier_id: form.get('supplier_id') }),
    }), onSaved);
  }
  return (
    <form onSubmit={submit} className="flex min-w-64 items-center gap-2">
      <select aria-label={`Company for ${manager.email}`} className="field min-w-0 py-2 text-xs" name="supplier_id" defaultValue={manager.supplier_id ?? ''}>
        <option value="">Unassigned</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
      <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50" disabled={feedback.pending}>{feedback.pending ? 'Saving…' : 'Save'}</button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </form>
  );
}

export function BatchForm({ suppliers, onSaved }: { suppliers: Supplier[]; onSaved: () => void }) {
  const feedback = useActionFeedback();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await feedback.run(() => apiRequest('offtake.php?action=create_batch', {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: form.get('supplier_id'),
        unit_quantity: form.get('unit_quantity'),
        unit_cost_price: form.get('unit_cost_price'),
        unit_selling_price: form.get('unit_selling_price'),
        fuel_subsidy_per_unit: form.get('fuel_subsidy_per_unit'),
        destination_route: form.get('destination_route'),
        vehicle_reference: form.get('vehicle_reference'),
        driver_name: form.get('driver_name'),
        driver_phone: form.get('driver_phone'),
      }),
    }), onSaved);
    if (saved) formElement.reset();
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <select className="field sm:col-span-2 xl:col-span-3" name="supplier_id" required defaultValue="">
        <option value="" disabled>Select supplier company</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
      <label className="text-xs font-semibold text-slate-600">Units<input className="field mt-1" name="unit_quantity" type="number" min="1" step="1" required /></label>
      <label className="text-xs font-semibold text-slate-600">Cost per unit<input className="field mt-1" name="unit_cost_price" type="number" min="0" step="0.01" required /></label>
      <label className="text-xs font-semibold text-slate-600">Selling price per unit<input className="field mt-1" name="unit_selling_price" type="number" min="0" step="0.01" required /></label>
      <label className="text-xs font-semibold text-slate-600">Fuel subsidy per unit<input className="field mt-1" name="fuel_subsidy_per_unit" type="number" min="0" step="0.01" defaultValue="0" required /></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Destination route<input className="field mt-1" name="destination_route" maxLength={255} placeholder="Origin → destination" /></label>
      <label className="text-xs font-semibold text-slate-600">Vehicle reference<input className="field mt-1" name="vehicle_reference" maxLength={80} /></label>
      <label className="text-xs font-semibold text-slate-600">Driver name<input className="field mt-1" name="driver_name" maxLength={160} /></label>
      <label className="text-xs font-semibold text-slate-600">Driver phone<input className="field mt-1" name="driver_phone" maxLength={40} /></label>
      <div className="flex items-end"><button className="button-primary w-full" disabled={feedback.pending || suppliers.length === 0}>{feedback.pending ? 'Saving…' : 'Create allocation'}</button></div>
      <div className="sm:col-span-2 xl:col-span-3"><ActionFeedback error={feedback.error} success={feedback.success} /></div>
      {suppliers.length === 0 && <p className="text-xs text-amber-800">Add a supplier company before creating an allocation.</p>}
    </form>
  );
}

export function ManagerBatchActions({ batch, onSaved }: { batch: Batch; onSaved: () => void }) {
  const feedback = useActionFeedback();
  if (batch.status !== 'pending' && batch.status !== 'in_transit') return <span className="text-xs text-slate-500">No action available</span>;
  const nextStatus = batch.status === 'pending' ? 'in_transit' : 'completed';
  return (
    <div>
      <button className="button-primary w-full px-3 py-2 text-xs" disabled={feedback.pending} onClick={() => {
        void feedback.run(() => apiRequest('offtake.php?action=update_status', {
          method: 'POST',
          body: JSON.stringify({ batch_id: batch.id, status: nextStatus }),
        }), onSaved);
      }}>
        {feedback.pending ? 'Updating…' : batch.status === 'pending' ? 'Mark loaded & in transit' : 'Mark delivered & complete'}
      </button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </div>
  );
}

export function AdminBatchStatusForm({ batch, onSaved }: { batch: Batch; onSaved: () => void }) {
  const feedback = useActionFeedback();
  if (batch.status === 'completed') return <span className="text-xs text-slate-500">Locked</span>;
  const statuses = batch.status === 'pending'
    ? ['in_transit', 'disputed']
    : batch.status === 'in_transit' ? ['completed', 'disputed'] : ['pending', 'in_transit'];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await feedback.run(() => apiRequest('offtake.php?action=update_status', {
      method: 'POST',
      body: JSON.stringify({ batch_id: batch.id, status: form.get('status') }),
    }), onSaved);
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <select name="status" aria-label="Set batch status" className="field min-w-28 py-2 text-xs" defaultValue={statuses[0]}>
        {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
      </select>
      <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50" disabled={feedback.pending}>{feedback.pending ? '…' : 'Set'}</button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </form>
  );
}
