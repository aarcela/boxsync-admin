'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import type { TranslationKey } from '@/lib/translations';
import type { HqImportKind } from '@/lib/hq-import/templates';
import type { HqImportSummary } from '@/lib/hq-import/types';

type PlanOption = { id: string; name: string; is_active: boolean };

type Props = {
  tenantId: string;
};

const ISSUE_KEYS = new Set<string>([
  'Missing plan name',
  'Duplicate plan name in file',
  'Invalid price',
  'Invalid limit type',
  'Weekly limit required',
  'Session limit and validity days required',
  'Unused limit fields must be empty',
  'Invalid weekly limit',
  'Invalid session limit',
  'Invalid validity days',
  'Invalid boolean. Use true or false.',
  'Plan already exists',
  'Missing email',
  'Invalid email',
  'Duplicate email in file',
  'Missing full name',
  'Invalid role',
  'Admin cannot be imported',
  'Missing plan name',
  'Unknown plan name',
  'Invalid solvent value',
  'Solvent members need plan_period_start (YYYY-MM-DD)',
  'Invalid plan_period_start',
  'Invalid language',
  'Invalid inscription plan',
  'Email belongs to another box',
  'Athlete already exists',
  'Import membership plans before members.',
  'Import would exceed member cap',
  'File is empty',
  'Too many rows (max 500)',
  'CSV too large',
  'Validation expired. Validate again.',
  'File does not match the last validation.',
  'Fix validation errors before importing.',
  'Could not import rows.',
]);

function translateIssue(
  t: (key: TranslationKey, params?: Record<string, string>) => string,
  message: string
): string {
  if (message.startsWith('Missing columns:')) {
    return t('Missing columns: {{cols}}', { cols: message.replace('Missing columns: ', '') });
  }
  if (ISSUE_KEYS.has(message)) {
    return t(message as TranslationKey);
  }
  return message;
}

export default function TenantImportPanel({ tenantId }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [kind, setKind] = useState<HqImportKind>('plans');
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<HqImportSummary | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sendInvites, setSendInvites] = useState(true);
  const [confirmImport, setConfirmImport] = useState(false);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/admin/hq/tenants/${tenantId}/import`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'load_failed');
    setPlans(data.plans ?? []);
  }, [tenantId]);

  useEffect(() => {
    loadMeta().catch(() => {
      toast(t('Could not load import.'), 'error');
    });
  }, [loadMeta, t, toast]);

  const onPickFile = async (next: File | null) => {
    setFile(next);
    setJobId(null);
    setSummary(null);
    if (!next) {
      setCsv('');
      return;
    }
    setCsv(await next.text());
  };

  const downloadTemplate = (templateKind: HqImportKind) => {
    window.location.href = `/api/admin/hq/tenants/${tenantId}/import?template=${templateKind}`;
  };

  const validate = async () => {
    if (!csv.trim()) {
      toast(t('Choose a CSV file first.'), 'error');
      return;
    }
    setValidating(true);
    try {
      const res = await fetch(`/api/admin/hq/tenants/${tenantId}/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          kind,
          csv,
          file_name: file?.name ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'validate_failed');
      setJobId(data.jobId);
      setSummary(data.summary as HqImportSummary);
      if (data.summary?.canCommit) {
        toast(t('Validation passed. Review then import.'), 'success');
      } else {
        toast(t('Validation found errors. Import is blocked.'), 'error');
      }
    } catch (error) {
      toast(
        error instanceof Error ? translateIssue(t, error.message) : t('Could not validate import.'),
        'error'
      );
    } finally {
      setValidating(false);
    }
  };

  const commit = async () => {
    if (!jobId || !csv.trim() || !summary?.canCommit) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/admin/hq/tenants/${tenantId}/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit',
          kind,
          csv,
          job_id: jobId,
          send_invites: kind === 'members' ? sendInvites : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.summary) setSummary(data.summary as HqImportSummary);
        throw new Error(data.error || 'import_failed');
      }
      toast(
        t('Imported {{count}} rows.', { count: String(data.created ?? 0) }),
        'success'
      );
      if (data.inviteWarnings > 0) {
        toast(t('Some invite emails could not be sent.'), 'error');
      }
      setJobId(null);
      setSummary(null);
      setFile(null);
      setCsv('');
      await loadMeta();
    } catch (error) {
      toast(
        error instanceof Error ? translateIssue(t, error.message) : t('Could not import rows.'),
        'error'
      );
    } finally {
      setImporting(false);
      setConfirmImport(false);
    }
  };

  const errorRows = summary?.rows.filter((row) => row.action === 'error').slice(0, 40) ?? [];

  return (
    <section className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
          {t('CSV import')}
        </h2>
        <p className="text-xs text-pits-ink-muted mt-1">{t('CSV import help')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadTemplate('plans')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-pits-edge text-xs font-bold uppercase tracking-widest text-pits-ink hover:bg-pits-surface-muted"
        >
          <Download size={14} />
          {t('Download plans template')}
        </button>
        <button
          type="button"
          onClick={() => downloadTemplate('members')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-pits-edge text-xs font-bold uppercase tracking-widest text-pits-ink hover:bg-pits-surface-muted"
        >
          <Download size={14} />
          {t('Download members template')}
        </button>
      </div>

      {plans.length > 0 && (
        <p className="text-xs text-pits-ink-muted">
          {t('Current plans')}: {plans.map((plan) => plan.name).join(', ')}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[160px_1fr] items-end">
        <div>
          <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
            {t('Import type')}
          </label>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as HqImportKind);
              setJobId(null);
              setSummary(null);
            }}
            className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium outline-none focus:ring-2 focus:ring-pits-primary/40"
          >
            <option value="plans">{t('Membership plans')}</option>
            <option value="members">{t('Athletes')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
            {t('CSV file')}
          </label>
          <label className="flex items-center gap-2 p-3 bg-pits-surface-muted border border-dashed border-pits-edge rounded-lg cursor-pointer text-sm text-pits-ink">
            <FileSpreadsheet size={16} />
            <span className="truncate">{file?.name ?? t('Choose CSV')}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {kind === 'members' && (
        <label className="flex items-center gap-2 text-sm text-pits-ink">
          <input
            type="checkbox"
            checked={sendInvites}
            onChange={(e) => setSendInvites(e.target.checked)}
          />
          {t('Send invite emails after import')}
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void validate()}
          disabled={validating || !csv}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-pits-edge font-bold uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {validating ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {validating ? t('Validating...') : t('Validate CSV')}
        </button>
        <button
          type="button"
          onClick={() => setConfirmImport(true)}
          disabled={!summary?.canCommit || importing || !jobId}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {importing ? <Loader2 size={16} className="animate-spin" /> : null}
          {importing ? t('Importing...') : t('Import validated rows')}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label={t('Rows')} value={summary.rowCount} />
          <MiniStat label={t('Will create')} value={summary.createCount} />
          <MiniStat label={t('Will skip')} value={summary.skipCount} />
          <MiniStat label={t('Errors')} value={summary.errorCount} warn={summary.errorCount > 0} />
        </div>
      )}

      {summary?.blockingErrors.map((message) => (
        <p key={message} className="text-sm font-medium text-red-700">
          {translateIssue(t, message)}
        </p>
      ))}

      {errorRows.length > 0 && (
        <div className="overflow-x-auto border border-red-200 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-red-50 text-xs font-bold uppercase tracking-wider text-red-700">
              <tr>
                <th className="px-3 py-2">{t('Line')}</th>
                <th className="px-3 py-2">{t('Row')}</th>
                <th className="px-3 py-2">{t('Errors')}</th>
              </tr>
            </thead>
            <tbody>
              {errorRows.map((row) => (
                <tr key={row.line} className="border-t border-red-100">
                  <td className="px-3 py-2 text-pits-ink-muted">{row.line}</td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 text-red-700">
                    {row.issues.map((issue) => translateIssue(t, issue)).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmImport}
        title={t('Import validated rows')}
        message={t('Import confirmation', { count: String(summary?.createCount ?? 0) })}
        confirmLabel={t('Import validated rows')}
        cancelLabel={t('Cancel')}
        onCancel={() => setConfirmImport(false)}
        onConfirm={() => void commit()}
      />
    </section>
  );
}

function MiniStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="bg-pits-surface-muted border border-pits-edge rounded-xl p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">{label}</p>
      <p className={`text-lg font-black italic ${warn ? 'text-red-700' : 'text-pits-ink'}`}>{value}</p>
    </div>
  );
}
