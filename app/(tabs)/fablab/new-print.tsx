import { Filament, Printer } from '@/lib/fablabTypes';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

type Step = 1 | 2 | 3;

interface PickedFile {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepIndicator({ current }: { current: Step }) {
  return (
    <View style={stepStyles.row}>
      {([1, 2, 3] as Step[]).map((s, i) => (
        <View key={s} style={stepStyles.item}>
          <View
            style={[
              stepStyles.circle,
              current === s && stepStyles.circleActive,
              current > s && stepStyles.circleDone,
            ]}
          >
            {current > s ? (
              <MaterialIcons name="check" size={14} color="#fff" />
            ) : (
              <Text style={[stepStyles.num, current === s && stepStyles.numActive]}>{s}</Text>
            )}
          </View>
          {i < 2 && (
            <View style={[stepStyles.line, current > s && stepStyles.lineDone]} />
          )}
        </View>
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  item: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: '#555',
    alignItems: 'center', justifyContent: 'center',
  },
  circleActive: { borderColor: GREEN, backgroundColor: GREEN + '22' },
  circleDone: { borderColor: GREEN, backgroundColor: GREEN },
  num: { fontSize: 13, fontFamily: 'Figtree-SemiBold', color: '#888' },
  numActive: { color: GREEN },
  line: { width: 48, height: 2, backgroundColor: '#333', marginHorizontal: 4 },
  lineDone: { backgroundColor: GREEN },
});

// ─── Step 1: File Picker ────────────────────────────────────────────────────

function Step1({
  file,
  onPick,
  onNext,
  isDark,
}: {
  file: PickedFile | null;
  onPick: () => void;
  onNext: () => void;
  isDark: boolean;
}) {
  const ext = file?.name.split('.').pop()?.toLowerCase();
  const validExt = ext && ['gcode', 'stl', 'obj'].includes(ext);

  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.stepTitle, { color: isDark ? '#fff' : '#000' }]}>Select File</Text>
      <Text style={[s.stepSub, { color: isDark ? '#888' : '#666' }]}>
        Supported formats: .gcode, .stl, .obj
      </Text>

      <Pressable
        style={[s.pickZone, { borderColor: file ? GREEN : isDark ? '#333' : '#ddd' }]}
        onPress={onPick}
      >
        <MaterialIcons
          name={file ? 'insert-drive-file' : 'upload-file'}
          size={40}
          color={file ? GREEN : isDark ? '#555' : '#ccc'}
        />
        {file ? (
          <>
            <Text style={[s.fileName, { color: isDark ? '#fff' : '#000' }]} numberOfLines={2}>
              {file.name}
            </Text>
            <Text style={[s.fileMeta, { color: isDark ? '#888' : '#666' }]}>
              {formatBytes(file.size)}
              {!validExt && (
                <Text style={{ color: '#f59e0b' }}> · Unusual extension</Text>
              )}
            </Text>
          </>
        ) : (
          <Text style={[s.pickHint, { color: isDark ? '#666' : '#aaa' }]}>
            Tap to pick a file
          </Text>
        )}
      </Pressable>

      <Pressable
        style={[s.primaryBtn, { opacity: file ? 1 : 0.4 }]}
        onPress={onNext}
        disabled={!file}
      >
        <Text style={s.primaryBtnText}>Next</Text>
        <MaterialIcons name="arrow-forward" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Step 2: Options ────────────────────────────────────────────────────────

function Step2({
  filaments,
  printers,
  selectedFilament,
  selectedPrinter,
  onSelectFilament,
  onSelectPrinter,
  loading,
  error,
  onRetry,
  onBack,
  onNext,
  isDark,
}: {
  filaments: Filament[];
  printers: Printer[];
  selectedFilament: Filament | null;
  selectedPrinter: Printer | null;
  onSelectFilament: (f: Filament) => void;
  onSelectPrinter: (p: Printer | null) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
  isDark: boolean;
}) {
  const cardBg = isDark ? '#1a1a1a' : '#f5f5f5';

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errText}>{error}</Text>
        <Pressable style={s.primaryBtn} onPress={onRetry}>
          <Text style={s.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      <Text style={[s.stepTitle, { color: isDark ? '#fff' : '#000' }]}>Options</Text>

      <Text style={[s.sectionLabel, { color: isDark ? '#aaa' : '#555' }]}>Filament *</Text>
      {filaments.map((f) => {
        const selected = selectedFilament?.id === f.id;
        return (
          <Pressable
            key={f.id}
            style={[
              s.optionCard,
              { backgroundColor: cardBg, borderColor: selected ? GREEN : 'transparent', borderWidth: 2 },
            ]}
            onPress={() => onSelectFilament(f)}
          >
            <View style={[s.colorSwatch, { backgroundColor: f.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.optionName, { color: isDark ? '#fff' : '#000' }]}>{f.name}</Text>
              <Text style={[s.optionMeta, { color: isDark ? '#888' : '#666' }]}>{f.material}</Text>
            </View>
            {selected && <MaterialIcons name="check-circle" size={22} color={GREEN} />}
          </Pressable>
        );
      })}

      {printers.length > 0 && (
        <>
          <Text style={[s.sectionLabel, { color: isDark ? '#aaa' : '#555', marginTop: 16 }]}>
            Printer (optional)
          </Text>
          {printers.map((p) => {
            const selected = selectedPrinter?.id === p.id;
            return (
              <Pressable
                key={p.id}
                style={[
                  s.optionCard,
                  { backgroundColor: cardBg, borderColor: selected ? GREEN : 'transparent', borderWidth: 2 },
                ]}
                onPress={() => onSelectPrinter(selected ? null : p)}
              >
                <MaterialIcons name="print" size={22} color={isDark ? '#aaa' : '#555'} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.optionName, { color: isDark ? '#fff' : '#000' }]}>{p.name}</Text>
                  {p.model && (
                    <Text style={[s.optionMeta, { color: isDark ? '#888' : '#666' }]}>{p.model}</Text>
                  )}
                </View>
                {selected && <MaterialIcons name="check-circle" size={22} color={GREEN} />}
              </Pressable>
            );
          })}
        </>
      )}

      <View style={s.navRow}>
        <Pressable style={s.secondaryBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={18} color={GREEN} />
          <Text style={s.secondaryBtnText}>Back</Text>
        </Pressable>
        <Pressable
          style={[s.primaryBtn, { flex: 1, marginLeft: 12, opacity: selectedFilament ? 1 : 0.4 }]}
          onPress={onNext}
          disabled={!selectedFilament}
        >
          <Text style={s.primaryBtnText}>Next</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Step 3: Confirm ────────────────────────────────────────────────────────

function Step3({
  file,
  filament,
  printer,
  uploading,
  error,
  onBack,
  onConfirm,
  isDark,
}: {
  file: PickedFile;
  filament: Filament;
  printer: Printer | null;
  uploading: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
  isDark: boolean;
}) {
  const cardBg = isDark ? '#1a1a1a' : '#f5f5f5';

  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.stepTitle, { color: isDark ? '#fff' : '#000' }]}>Confirm</Text>

      <View style={[s.summaryCard, { backgroundColor: cardBg }]}>
        <Row label="File" value={file.name} isDark={isDark} />
        <Row label="Size" value={formatBytes(file.size)} isDark={isDark} />
        <View style={s.divider} />
        <View style={s.summaryRow}>
          <Text style={[s.rowLabel, { color: isDark ? '#888' : '#666' }]}>Filament</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[s.colorDot, { backgroundColor: filament.color }]} />
            <Text style={[s.rowValue, { color: isDark ? '#fff' : '#000' }]}>
              {filament.name} · {filament.material}
            </Text>
          </View>
        </View>
        {printer && <Row label="Printer" value={printer.name} isDark={isDark} />}
      </View>

      {error && (
        <View style={s.errorBox}>
          <MaterialIcons name="error-outline" size={18} color="#ef4444" />
          <Text style={s.errText}>{error}</Text>
        </View>
      )}

      <View style={s.navRow}>
        <Pressable style={s.secondaryBtn} onPress={onBack} disabled={uploading}>
          <MaterialIcons name="arrow-back" size={18} color={GREEN} />
          <Text style={s.secondaryBtnText}>Back</Text>
        </Pressable>
        <Pressable
          style={[s.primaryBtn, { flex: 1, marginLeft: 12, opacity: uploading ? 0.7 : 1 }]}
          onPress={onConfirm}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialIcons name="cloud-upload" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>Submit Job</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.rowLabel, { color: isDark ? '#888' : '#666' }]}>{label}</Text>
      <Text style={[s.rowValue, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function NewPrintScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({ name: asset.name, size: asset.size, uri: asset.uri, mimeType: asset.mimeType ?? undefined });
  };

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const [fl, pr] = await Promise.all([
        supabase.from('filaments').select('*').eq('available', true).order('name'),
        supabase.from('printers').select('*').eq('status', 'idle').order('name'),
      ]);
      if (fl.error) throw fl.error;
      if (pr.error) throw pr.error;
      setFilaments(fl.data as Filament[]);
      setPrinters(pr.data as Printer[]);
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : 'Failed to load options');
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const goToStep2 = () => {
    setStep(2);
    if (filaments.length === 0) loadOptions();
  };

  const confirmAndUpload = async () => {
    if (!file || !selectedFilament) return;
    setUploading(true);
    setUploadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a job ID client-side so we can build the storage path
      const jobId = generateId();
      const storagePath = `prints/${user.id}/${jobId}/${file.name}`;

      const fetchRes = await fetch(file.uri);
      const blob = await fetchRes.blob();

      const { error: uploadErr } = await supabase.storage
        .from('print-files')
        .upload(storagePath, blob, {
          contentType: file.mimeType ?? 'application/octet-stream',
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from('print_jobs').insert({
        id: jobId,
        user_id: user.id,
        filename: file.name,
        file_path: storagePath,
        filament_id: selectedFilament.id,
        printer_id: selectedPrinter?.id ?? null,
        status: 'pending_upload',
      });
      if (insertErr) throw insertErr;

      router.back();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const bg = isDark ? '#1e1e1e' : '#fff';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => (step > 1 ? setStep((step - 1) as Step) : router.back())} style={s.backBtn}>
          <MaterialIcons name="close" size={24} color={isDark ? '#fff' : '#000'} />
        </Pressable>
        <Text style={[s.screenTitle, { color: isDark ? '#fff' : '#000' }]}>New Print</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator current={step} />

      <View style={s.content}>
        {step === 1 && (
          <Step1
            file={file}
            onPick={pickFile}
            onNext={goToStep2}
            isDark={isDark}
          />
        )}
        {step === 2 && (
          <Step2
            filaments={filaments}
            printers={printers}
            selectedFilament={selectedFilament}
            selectedPrinter={selectedPrinter}
            onSelectFilament={setSelectedFilament}
            onSelectPrinter={setSelectedPrinter}
            loading={optionsLoading}
            error={optionsError}
            onRetry={loadOptions}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            isDark={isDark}
          />
        )}
        {step === 3 && file && selectedFilament && (
          <Step3
            file={file}
            filament={selectedFilament}
            printer={selectedPrinter}
            uploading={uploading}
            error={uploadError}
            onBack={() => setStep(2)}
            onConfirm={confirmAndUpload}
            isDark={isDark}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: { padding: 8, width: 40 },
  screenTitle: { fontSize: 18, fontFamily: 'Figtree-SemiBold' },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 24 },
  stepTitle: { fontSize: 22, fontFamily: 'Figtree-Bold', marginBottom: 6 },
  stepSub: { fontSize: 14, fontFamily: 'Figtree-Regular', marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontFamily: 'Figtree-SemiBold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickZone: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
    marginBottom: 24,
    minHeight: 180,
  },
  fileName: { fontSize: 15, fontFamily: 'Figtree-SemiBold', textAlign: 'center' },
  fileMeta: { fontSize: 13, fontFamily: 'Figtree-Regular' },
  pickHint: { fontSize: 14, fontFamily: 'Figtree-Regular' },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  optionName: { fontSize: 15, fontFamily: 'Figtree-SemiBold' },
  optionMeta: { fontSize: 13, fontFamily: 'Figtree-Regular', marginTop: 2 },
  summaryCard: { borderRadius: 16, padding: 16, gap: 10, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, fontFamily: 'Figtree-Regular' },
  rowValue: { fontSize: 14, fontFamily: 'Figtree-SemiBold', maxWidth: '65%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 4 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingTop: 16 },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: GREEN,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree-SemiBold' },
  secondaryBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: GREEN,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 6,
  },
  secondaryBtnText: { color: GREEN, fontSize: 15, fontFamily: 'Figtree-SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errText: { color: '#ef4444', fontSize: 14, fontFamily: 'Figtree-Regular', textAlign: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef444422',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
});
