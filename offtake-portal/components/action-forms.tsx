'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/portal-api';
import type { Batch, ManagerProfile, Supplier } from '@/lib/types';
import { money, statusLabel } from '@/lib/format';

function ActionFeedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return <p role={error ? 'alert' : 'status'} className={`mt-3 rounded-lg p-2.5 text-xs ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{error ?? success}</p>;
}

function isNotificationChannels(value: unknown): value is Partial<Record<'telegram' | 'email', boolean>> {
  return typeof value === 'object' && value !== null
    && (!('telegram' in value) || typeof value.telegram === 'boolean')
    && (!('email' in value) || typeof value.email === 'boolean');
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
        const notificationChannels = typeof result === 'object' && result !== null && 'notification_channels' in result
          ? result.notification_channels
          : null;
        const failedChannels = isNotificationChannels(notificationChannels)
          ? (['telegram', 'email'] as const).filter((channel) => notificationChannels[channel] === false)
          : [];
        const payoutAmount = typeof result === 'object' && result !== null && 'paid' in result && result.paid === true
          && 'amount' in result && (typeof result.amount === 'string' || typeof result.amount === 'number')
          ? money(Number(result.amount))
          : null;
        setSuccess(payoutAmount
          ? `Recorded payout of ${payoutAmount}.`
          : notification === 'sent'
          ? 'Saved successfully. Telegram and email alerts were sent.'
          : notification === 'failed'
            ? `Saved successfully, but ${failedChannels.join(' and ') || 'a shipment notification'} alert failed. Check the server notification configuration.`
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

const inventoryDraftFields = [
  'product_name',
  'unit_quantity',
  'initial_purchase_amount',
  'sales_discount_percent',
  'wholesale_supply_price',
  'manager_allowance_percent',
  'destination_route',
  'vehicle_reference',
  'driver_name',
  'driver_phone',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
      body: JSON.stringify({ user_id: manager.id, supplier_ids: form.getAll('supplier_ids') }),
    }), onSaved);
  }
  return (
    <form onSubmit={submit} className="flex min-w-64 items-center gap-2">
      <select aria-label={`Company workspaces for ${manager.email}`} className="field min-w-0 py-2 text-xs" name="supplier_ids" multiple size={Math.min(4, Math.max(2, suppliers.length))} defaultValue={manager.supplier_ids}>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
      </select>
      <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50" disabled={feedback.pending}>{feedback.pending ? 'Saving…' : 'Save access'}</button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </form>
  );
}

export function InventoryBatchEditor({
  supplierId,
  managerId,
  batch,
  onSaved,
}: {
  supplierId: string;
  managerId: string;
  batch?: Batch;
  onSaved: () => void;
}) {
  const feedback = useActionFeedback();
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [draftError, setDraftError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = `vanguard-inventory-draft:${managerId}:${supplierId}`;

  useEffect(() => {
    if (batch || !createFormOpen || !formRef.current) return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (!isRecord(parsed)) throw new TypeError('The saved product batch defaults are invalid.');
      for (const field of inventoryDraftFields) {
        const value = parsed[field];
        const input = formRef.current.elements.namedItem(field);
        if (typeof value === 'string' && input instanceof HTMLInputElement) {
          input.value = value;
        }
      }
    } catch (reason) {
      console.error('Unable to load previous product batch entries.', reason);
    }
  }, [batch, createFormOpen, draftKey]);

  function saveDraft(formElement: HTMLFormElement) {
    const draft: Record<string, string> = {};
    for (const field of inventoryDraftFields) {
      const input = formElement.elements.namedItem(field);
      if (input instanceof HTMLInputElement) draft[field] = input.value;
    }
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftError('');
    } catch (reason) {
      console.error('Unable to retain product batch entries for next time.', reason);
      setDraftError('Your batch was saved, but these entries could not be retained for next time.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      supplier_id: supplierId,
      batch_id: batch?.id,
      product_name: form.get('product_name'),
      unit_quantity: form.get('unit_quantity'),
      initial_purchase_amount: form.get('initial_purchase_amount'),
      sales_discount_percent: form.get('sales_discount_percent'),
      wholesale_supply_price: form.get('wholesale_supply_price'),
      manager_allowance_percent: form.get('manager_allowance_percent'),
      destination_route: form.get('destination_route'),
      vehicle_reference: form.get('vehicle_reference'),
      driver_name: form.get('driver_name'),
      driver_phone: form.get('driver_phone'),
    };
    const saved = await feedback.run(() => apiRequest(`offtake.php?action=${batch ? 'update_batch' : 'create_batch'}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }), onSaved);
    if (saved && !batch) setDraftError('');
  }
  const form = (
    <form
      ref={batch ? undefined : formRef}
      onInput={batch ? undefined : (event) => saveDraft(event.currentTarget)}
      onSubmit={(event) => void submit(event)}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-3">Product name<input className="field mt-1" name="product_name" minLength={2} maxLength={160} defaultValue={batch?.product_name || ''} required /></label>
      <label className="text-xs font-semibold text-slate-600">Quantity (units)<input className="field mt-1" name="unit_quantity" type="number" min="1" step="1" defaultValue={batch?.unit_quantity ?? ''} required /></label>
      <label className="text-xs font-semibold text-slate-600">Initial purchase amount (batch total)<input className="field mt-1" name="initial_purchase_amount" type="number" min="0" step="0.01" defaultValue={batch?.initial_purchase_amount ?? ''} required /></label>
      <label className="text-xs font-semibold text-slate-600">Sales discount (%)<input className="field mt-1" name="sales_discount_percent" type="number" min="0" max="100" step="0.01" defaultValue={batch?.sales_discount_percent ?? '0'} required /></label>
      <label className="text-xs font-semibold text-slate-600">Expected wholesale price (per unit)<input className="field mt-1" name="wholesale_supply_price" type="number" min="0" step="0.01" defaultValue={batch?.wholesale_supply_price ?? ''} required /></label>
      <label className="text-xs font-semibold text-slate-600">Manager petrol allowance (%)<input className="field mt-1" name="manager_allowance_percent" type="number" min="0" max="100" step="0.01" defaultValue={batch?.manager_allowance_percent ?? '15'} required /></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Destination route (optional)<input className="field mt-1" name="destination_route" maxLength={255} defaultValue={batch?.destination_route ?? ''} placeholder="Origin → destination" /></label>
      <label className="text-xs font-semibold text-slate-600">Vehicle reference<input className="field mt-1" name="vehicle_reference" maxLength={80} defaultValue={batch?.vehicle_reference ?? ''} /></label>
      <label className="text-xs font-semibold text-slate-600">Driver name<input className="field mt-1" name="driver_name" maxLength={160} defaultValue={batch?.driver_name ?? ''} /></label>
      <label className="text-xs font-semibold text-slate-600">Driver phone<input className="field mt-1" name="driver_phone" maxLength={40} defaultValue={batch?.driver_phone ?? ''} /></label>
      <div className="flex items-end"><button className="button-primary w-full" disabled={feedback.pending}>{feedback.pending ? 'Saving…' : batch ? 'Save product updates' : 'Add product batch'}</button></div>
      <div className="sm:col-span-2 xl:col-span-3"><ActionFeedback error={feedback.error} success={feedback.success} /></div>
    </form>
  );
  return batch ? (
    <details className="mt-4 rounded-xl border border-[var(--line)] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--green)]">Edit unfunded product details</summary>
      <div className="mt-4">{form}</div>
    </details>
  ) : (
    <section className="space-y-3">
      <button
        type="button"
        className="button-primary"
        aria-expanded={createFormOpen}
        aria-controls={`new-inventory-batch-${supplierId}`}
        disabled={feedback.pending}
        onClick={() => setCreateFormOpen((open) => !open)}
      >
        {createFormOpen ? 'Close Add Product form' : 'Add Product'}
      </button>
      {createFormOpen && (
        <div id={`new-inventory-batch-${supplierId}`} className="surface p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="font-semibold">Add product batch</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Purchase amount is the total batch capital; wholesale price is per unit; discount is applied as a percentage of sales. Previous entries are reused and can be edited.</p>
          </div>
          {draftError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">{draftError}</p>}
          {form}
        </div>
      )}
    </section>
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
  if (batch.status !== 'pending' && batch.status !== 'paid' && batch.status !== 'in_transit') return <span className="text-xs text-slate-500">No action available</span>;
  const nextStatus = batch.status === 'pending' ? 'paid' : batch.status === 'paid' ? 'in_transit' : 'completed';
  const label = batch.status === 'pending' ? 'Updated & Paid'
    : batch.status === 'paid' ? 'Loaded & In Transit'
      : 'Mark Sold / Complete';
  return (
    <div>
      <button className="button-primary w-full px-3 py-2 text-xs" disabled={feedback.pending} onClick={() => {
        void feedback.run(() => apiRequest('offtake.php?action=update_status', {
          method: 'POST',
          body: JSON.stringify({ batch_id: batch.id, status: nextStatus }),
        }), onSaved);
      }}>
        {feedback.pending ? 'Updating…' : label}
      </button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </div>
  );
}

export function AdminBatchStatusForm({ batch, onSaved }: { batch: Batch; onSaved: () => void }) {
  const feedback = useActionFeedback();
  if (batch.status === 'completed') return <span className="text-xs text-slate-500">Locked</span>;
  const statuses = batch.status === 'pending'
    ? ['paid', 'in_transit', 'disputed']
    : batch.status === 'paid' ? ['in_transit', 'disputed']
      : batch.status === 'in_transit' ? ['completed', 'disputed'] : ['pending', 'paid', 'in_transit'];
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

export function WeeklyPayoutForm({
  supplierId,
  weekStart,
  amount,
  paidAmount,
  netCredit,
  onSaved,
}: {
  supplierId: string;
  weekStart: string;
  amount: number;
  paidAmount: number;
  netCredit: number;
  onSaved: () => void;
}) {
  const feedback = useActionFeedback();
  if (Number(amount) <= 0) {
    const label = Number(paidAmount) > 0 && Number(paidAmount) >= Number(netCredit) ? 'Paid' : 'No payout due';
    return <span className="text-xs font-semibold text-emerald-700">{label}</span>;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`Confirm that the outstanding payout of ${money(amount)} has been transferred?`)) return;
    const form = new FormData(event.currentTarget);
    await feedback.run(() => apiRequest<{ paid: true; amount: string }>('offtake.php?action=record_weekly_payout', {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: supplierId,
        week_start: weekStart,
        transfer_reference: form.get('transfer_reference'),
      }),
    }), onSaved);
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="min-w-52 space-y-2">
      <input className="field py-2 text-xs" name="transfer_reference" maxLength={120} placeholder="Transfer reference (optional)" aria-label="Transfer reference (optional)" />
      <button className="button-primary w-full px-3 py-2 text-xs" disabled={feedback.pending}>
        {feedback.pending ? 'Recording…' : `Record ${money(amount)} paid`}
      </button>
      <ActionFeedback error={feedback.error} success={feedback.success} />
    </form>
  );
}
