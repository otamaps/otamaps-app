import {
  PrintJob,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/fablabTypes';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN = '#87b72f';

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
  );
}

function JobCard({
  job,
  onPress,
  isDark,
}: {
  job: PrintJob;
  onPress: () => void;
  isDark: boolean;
}) {
  const color = STATUS_COLORS[job.status];
  return (
    <Pressable
      style={[styles.card, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[styles.filename, { color: isDark ? '#fff' : '#111' }]}
          numberOfLines={1}
        >
          {job.filename}
        </Text>
        <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[job.status]}</Text>
        </View>
      </View>

      {job.filament && (
        <View style={styles.row}>
          <View style={[styles.colorDot, { backgroundColor: job.filament.color }]} />
          <Text style={[styles.meta, { color: isDark ? '#aaa' : '#666' }]}>
            {job.filament.name} · {job.filament.material}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        {job.estimated_cost != null ? (
          <Text style={[styles.cost, { color: GREEN }]}>
            €{job.estimated_cost.toFixed(2)}
          </Text>
        ) : (
          <View />
        )}
        <Text style={[styles.timestamp, { color: isDark ? '#666' : '#aaa' }]}>
          {formatDate(job.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FablabScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: err } = await supabase
        .from('print_jobs')
        .select('*, filament:filaments(id,name,material,color)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setJobs((data ?? []) as PrintJob[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load print jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel('fablab-jobs-list')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'print_jobs',
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchJobs()
        )
        .subscribe();
    });

    return () => {
      channel?.unsubscribe();
    };
  }, [fetchJobs]);

  const bg = isDark ? '#1e1e1e' : '#fff';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>My Prints</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={40} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchJobs}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="print" size={56} color={isDark ? '#333' : '#ddd'} />
          <Text style={[styles.emptyTitle, { color: isDark ? '#555' : '#bbb' }]}>
            No print jobs yet
          </Text>
          <Text style={[styles.emptySub, { color: isDark ? '#444' : '#ccc' }]}>
            Tap + to start a new print
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              isDark={isDark}
              onPress={() => router.push(`/(tabs)/fablab/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(tabs)/fablab/new-print')}
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Figtree-Bold',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filename: {
    fontSize: 15,
    fontFamily: 'Figtree-SemiBold',
    flex: 1,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Figtree-SemiBold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  meta: {
    fontSize: 13,
    fontFamily: 'Figtree-Regular',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  cost: {
    fontSize: 15,
    fontFamily: 'Figtree-Bold',
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Figtree-Regular',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Figtree-Regular',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: GREEN,
  },
  retryText: {
    color: '#fff',
    fontFamily: 'Figtree-SemiBold',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Figtree-SemiBold',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Figtree-Regular',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
