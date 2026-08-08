import {
  PrintJob,
  PrintJobStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_STEPS,
} from '@/lib/fablabTypes';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useSumUp } from 'sumup-react-native-alpha';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN = '#87b72f';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
  );
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Status Stepper ─────────────────────────────────────────────────────────

function StatusStepper({ status, isDark }: { status: PrintJobStatus; isDark: boolean }) {
  const isTerminal = status === 'rejected' || status === 'failed';
  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <View style={st.container}>
      {STATUS_STEPS.map((stepStatus, idx) => {
        const isDone = !isTerminal && currentIdx > idx;
        const isCurrent = !isTerminal && currentIdx === idx;
        const dotColor = isDone || isCurrent ? STATUS_COLORS[stepStatus] : isDark ? '#333' : '#e0e0e0';
        const isLast = idx === STATUS_STEPS.length - 1;

        return (
          <View key={stepStatus} style={st.step}>
            <View style={st.spine}>
              <View style={[st.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                {isDone && <MaterialIcons name="check" size={12} color="#fff" />}
                {isCurrent && <View style={st.innerDot} />}
              </View>
              {!isLast && (
                <View style={[st.line, { backgroundColor: isDone ? GREEN : isDark ? '#2a2a2a' : '#e5e5e5' }]} />
              )}
            </View>
            <Text
              style={[
                st.label,
                { color: isCurrent ? STATUS_COLORS[stepStatus] : isDone ? (isDark ? '#ccc' : '#555') : isDark ? '#444' : '#bbb' },
                isCurrent && st.labelActive,
              ]}
            >
              {STATUS_LABELS[stepStatus]}
            </Text>
          </View>
        );
      })}

      {isTerminal && (
        <View style={st.step}>
          <View style={st.spine}>
            <View style={[st.dot, { backgroundColor: STATUS_COLORS[status], borderColor: STATUS_COLORS[status] }]}>
              <MaterialIcons name="close" size={12} color="#fff" />
            </View>
          </View>
          <Text style={[st.label, { color: STATUS_COLORS[status] }, st.labelActive]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { paddingVertical: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 44 },
  spine: { alignItems: 'center', width: 28, marginRight: 14 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 2 },
  label: { fontSize: 14, fontFamily: 'Figtree-Regular', paddingTop: 3, flex: 1 },
  labelActive: { fontFamily: 'Figtree-SemiBold' },
});

// ─── Info Row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={d.infoRow}>
      <Text style={[d.infoLabel, { color: isDark ? '#888' : '#666' }]}>{label}</Text>
      <Text style={[d.infoValue, { color: isDark ? '#fff' : '#000' }]}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PrintJobScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useSumUp();

  const [job, setJob] = useState<PrintJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*, filament:filaments(id,name,material,color), printer:printers(id,name,model)')
        .eq('id', jobId)
        .single();
      if (error) throw error;
      setJob(data as PrintJob);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();

    const channel = supabase
      .channel(`fablab-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'print_jobs', filter: `id=eq.${jobId}` },
        (payload) => setJob((prev) => prev ? { ...prev, ...(payload.new as Partial<PrintJob>) } : prev)
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [jobId, fetchJob]);

  const handlePayNow = async () => {
    if (!job) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${BACKEND_URL}/jobs/${job.id}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Server error ${res.status}`);
      }
      const { checkoutId } = await res.json();

      const { error: initErr } = await initPaymentSheet({
        checkoutId,
        // SumUp's current React Native SDK supports English and Swedish only.
        // Supplying a language avoids its optional, unmaintained native locale module.
        language: 'en',
      });
      if (initErr) throw new Error(initErr.status === 'failure' ? initErr.message : 'Failed to prepare payment');

      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr && presentErr.status !== 'canceled') {
        throw new Error(presentErr.status === 'failure' ? presentErr.message : 'Payment failed');
      }
      // Realtime will push the status update
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const bg = isDark ? '#1e1e1e' : '#fff';
  const cardBg = isDark ? '#1a1a1a' : '#f5f5f5';

  if (loading) {
    return (
      <SafeAreaView style={[d.container, { backgroundColor: bg }]}>
        <View style={d.center}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (fetchError || !job) {
    return (
      <SafeAreaView style={[d.container, { backgroundColor: bg }]}>
        <Pressable onPress={() => router.back()} style={d.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </Pressable>
        <View style={d.center}>
          <MaterialIcons name="error-outline" size={40} color="#ef4444" />
          <Text style={d.errText}>{fetchError ?? 'Job not found'}</Text>
          <Pressable style={d.primaryBtn} onPress={fetchJob}>
            <Text style={d.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[job.status];

  return (
    <SafeAreaView style={[d.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={d.header}>
        <Pressable onPress={() => router.back()} style={d.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </Pressable>
        <Text style={[d.title, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
          {job.filename}
        </Text>
        <View style={[d.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[d.badgeText, { color: statusColor }]}>{STATUS_LABELS[job.status]}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={d.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status-specific panels ── */}

        {job.status === 'cost_estimated' && (
          <View style={[d.costCard, { backgroundColor: cardBg, borderColor: GREEN }]}>
            <Text style={[d.costCardTitle, { color: isDark ? '#fff' : '#000' }]}>
              Your print has been estimated
            </Text>
            <View style={d.costRow}>
              {job.estimated_grams != null && (
                <CostPill icon="scale" label="Weight" value={`${job.estimated_grams}g`} isDark={isDark} />
              )}
              {job.estimated_duration_minutes != null && (
                <CostPill icon="schedule" label="Time" value={formatDuration(job.estimated_duration_minutes)} isDark={isDark} />
              )}
              {job.estimated_cost != null && (
                <CostPill icon="euro" label="Cost" value={`€${job.estimated_cost.toFixed(2)}`} isDark={isDark} highlight />
              )}
            </View>
            {paymentError && (
              <View style={d.errorBox}>
                <MaterialIcons name="error-outline" size={16} color="#ef4444" />
                <Text style={d.errText}>{paymentError}</Text>
                <Pressable onPress={() => setPaymentError(null)}>
                  <MaterialIcons name="close" size={16} color="#ef4444" />
                </Pressable>
              </View>
            )}
            <Pressable
              style={[d.primaryBtn, { opacity: paymentLoading ? 0.7 : 1 }]}
              onPress={handlePayNow}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="payment" size={20} color="#fff" />
                  <Text style={d.primaryBtnText}>Pay Now</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {job.status === 'awaiting_payment' && (
          <View style={[d.infoPanel, { backgroundColor: '#f97316' + '22', borderColor: '#f97316' }]}>
            <MaterialIcons name="payment" size={22} color="#f97316" />
            <View style={{ flex: 1 }}>
              <Text style={[d.panelTitle, { color: '#f97316' }]}>Payment required</Text>
              {job.estimated_cost != null && (
                <Text style={[d.panelSub, { color: isDark ? '#ccc' : '#555' }]}>
                  Amount due: €{job.estimated_cost.toFixed(2)}
                </Text>
              )}
            </View>
            <Pressable
              style={[d.inlinePay, { opacity: paymentLoading ? 0.7 : 1 }]}
              onPress={handlePayNow}
              disabled={paymentLoading}
            >
              {paymentLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={d.inlinePayText}>Pay</Text>
              )}
            </Pressable>
          </View>
        )}

        {paymentError && job.status === 'awaiting_payment' && (
          <View style={d.errorBox}>
            <MaterialIcons name="error-outline" size={16} color="#ef4444" />
            <Text style={d.errText}>{paymentError}</Text>
            <Pressable onPress={() => setPaymentError(null)}>
              <MaterialIcons name="close" size={16} color="#ef4444" />
            </Pressable>
          </View>
        )}

        {job.status === 'awaiting_approval' && (
          <View style={[d.infoPanel, { backgroundColor: '#a78bfa' + '22', borderColor: '#a78bfa' }]}>
            <ActivityIndicator color="#a78bfa" size="small" />
            <View style={{ flex: 1 }}>
              <Text style={[d.panelTitle, { color: '#a78bfa' }]}>Waiting for staff review</Text>
              <Text style={[d.panelSub, { color: isDark ? '#ccc' : '#555' }]}>
                A staff member will review your job shortly.
              </Text>
            </View>
          </View>
        )}

        {job.status === 'printing' && (
          <View style={[d.infoPanel, { backgroundColor: '#3b82f6' + '22', borderColor: '#3b82f6' }]}>
            <ActivityIndicator color="#3b82f6" />
            <View style={{ flex: 1 }}>
              <Text style={[d.panelTitle, { color: '#3b82f6' }]}>Printing in progress</Text>
              {job.print_started_at && (
                <Text style={[d.panelSub, { color: isDark ? '#ccc' : '#555' }]}>
                  Started {formatDate(job.print_started_at)}
                </Text>
              )}
            </View>
          </View>
        )}

        {job.status === 'completed' && (
          <View style={[d.infoPanel, { backgroundColor: '#22c55e' + '22', borderColor: '#22c55e' }]}>
            <MaterialIcons name="check-circle" size={22} color="#22c55e" />
            <View style={{ flex: 1 }}>
              <Text style={[d.panelTitle, { color: '#22c55e' }]}>Print completed</Text>
              {job.completed_at && (
                <Text style={[d.panelSub, { color: isDark ? '#ccc' : '#555' }]}>
                  {formatDate(job.completed_at)}
                </Text>
              )}
            </View>
          </View>
        )}

        {job.status === 'failed' && (
          <View style={[d.infoPanel, { backgroundColor: '#ef4444' + '22', borderColor: '#ef4444' }]}>
            <MaterialIcons name="error" size={22} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={[d.panelTitle, { color: '#ef4444' }]}>Print failed</Text>
              {job.completed_at && (
                <Text style={[d.panelSub, { color: isDark ? '#ccc' : '#555' }]}>
                  {formatDate(job.completed_at)}
                </Text>
              )}
            </View>
          </View>
        )}

        {job.status === 'rejected' && (
          <View style={[d.infoPanel, { backgroundColor: '#ef4444' + '22', borderColor: '#ef4444' }]}>
            <MaterialIcons name="cancel" size={22} color="#ef4444" />
            <View style={{ flex: 1 }}>
              <Text style={[d.panelTitle, { color: '#ef4444' }]}>Job rejected</Text>
              {job.review_note ? (
                <Text style={[d.panelSub, { color: isDark ? '#ccc' : '#555' }]}>
                  {job.review_note}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Job details ── */}
        <View style={[d.section, { backgroundColor: cardBg }]}>
          <Text style={[d.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>Details</Text>
          <InfoRow label="File" value={job.filename} isDark={isDark} />
          {job.filament && (
            <View style={d.infoRow}>
              <Text style={[d.infoLabel, { color: isDark ? '#888' : '#666' }]}>Filament</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[d.colorDot, { backgroundColor: job.filament.color }]} />
                <Text style={[d.infoValue, { color: isDark ? '#fff' : '#000' }]}>
                  {job.filament.name} · {job.filament.material}
                </Text>
              </View>
            </View>
          )}
          {job.printer && <InfoRow label="Printer" value={job.printer.name} isDark={isDark} />}
          {job.estimated_grams != null && (
            <InfoRow label="Weight" value={`${job.estimated_grams}g`} isDark={isDark} />
          )}
          {job.estimated_duration_minutes != null && (
            <InfoRow label="Duration" value={formatDuration(job.estimated_duration_minutes)} isDark={isDark} />
          )}
          {job.estimated_cost != null && (
            <InfoRow label="Cost" value={`€${job.estimated_cost.toFixed(2)}`} isDark={isDark} />
          )}
          <InfoRow label="Submitted" value={formatDate(job.created_at)} isDark={isDark} />
        </View>

        {/* ── Status stepper ── */}
        <View style={[d.section, { backgroundColor: cardBg }]}>
          <Text style={[d.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>Progress</Text>
          <StatusStepper status={job.status} isDark={isDark} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CostPill({
  icon,
  label,
  value,
  isDark,
  highlight,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  isDark: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={[d.costPill, { backgroundColor: highlight ? GREEN + '22' : isDark ? '#222' : '#eee' }]}>
      <MaterialIcons name={icon} size={16} color={highlight ? GREEN : isDark ? '#aaa' : '#666'} />
      <Text style={[d.costPillLabel, { color: isDark ? '#888' : '#666' }]}>{label}</Text>
      <Text style={[d.costPillValue, { color: highlight ? GREEN : isDark ? '#fff' : '#000' }]}>{value}</Text>
    </View>
  );
}

const d = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 17, fontFamily: 'Figtree-SemiBold' },
  badge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Figtree-SemiBold' },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Cost card
  costCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  costCardTitle: { fontSize: 16, fontFamily: 'Figtree-SemiBold' },
  costRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  costPill: {
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 3,
    flex: 1,
    minWidth: 80,
  },
  costPillLabel: { fontSize: 11, fontFamily: 'Figtree-Regular' },
  costPillValue: { fontSize: 15, fontFamily: 'Figtree-Bold' },

  // Info panel
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  panelTitle: { fontSize: 15, fontFamily: 'Figtree-SemiBold' },
  panelSub: { fontSize: 13, fontFamily: 'Figtree-Regular', marginTop: 2 },

  // Pay inline
  inlinePay: {
    backgroundColor: '#f97316',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'center',
  },
  inlinePayText: { color: '#fff', fontFamily: 'Figtree-SemiBold', fontSize: 14 },

  // Section card
  section: { borderRadius: 16, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: 'Figtree-SemiBold', marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { fontSize: 14, fontFamily: 'Figtree-Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Figtree-SemiBold', maxWidth: '60%', textAlign: 'right' },
  colorDot: { width: 12, height: 12, borderRadius: 6 },

  // Shared
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree-SemiBold' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef444422',
    borderRadius: 10,
    padding: 10,
  },
  errText: {
    color: '#ef4444',
    fontSize: 13,
    fontFamily: 'Figtree-Regular',
    flex: 1,
  },
});
