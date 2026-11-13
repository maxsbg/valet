import { useBottomInset } from '@/lib/bottomInset';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui';
import { ItemFormFields, readForm, toForm, type ItemForm } from '@/components/ItemForm';
import { Sheet, SheetButton } from '@/components/Sheet';
import { PictureEdit } from '@/components/PictureEdit';
import type { Picture } from '@/lib/cutout';
import { useSession } from '@/lib/session';
import { useTheme, DISPLAY, space } from '@/lib/theme';
import { loadItem, loadPictures, updateItem, deleteItem, saveImage, type ItemRow } from '@/lib/item';
import { nameToHex } from '@/lib/wardrobe';

export default function Bearbeiten() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { wardrobe, patch, reload } = useSession();
  const [orig, setOrig] = useState<ItemRow | null>(null);
  const [f, setF] = useState<ItemForm | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [current, setCurrent] = useState<Record<'a' | 'b', string | null>>({ a: null, b: null });
  const [pics, setPics] = useState<Record<'a' | 'b', Picture | null>>({ a: null, b: null });
  const bottom = useBottomInset();
  const toast = useToast(bottom + 90);

  useEffect(() => {
    loadItem(id).then((d) => { setOrig(d.item); setF(toForm(d.item)); }).catch((e) => toast.show(e.message));
    loadPictures(id).then(setCurrent).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tileHex = wardrobe?.items.find((i) => i.id === id)?.hex;
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/teil/${id}`));
  if (!f || !orig) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;

  async function save() {
    if (!f) return;
    const r = readForm(f);
    if ('error' in r) return toast.show(r.error);
    const { change } = r;
    const { price_paid: price, list_price: list, qty, color, purchase_date: date } = change;
    setSaving(true);
    try {
      // Neue Bilder zuerst, damit bei einem Fehler nichts halb gespeichert ist
      const sides = (['a', 'b'] as const).filter((x) => pics[x] && (x === 'a' || f.reversible));
      for (const x of sides) await saveImage(orig!.wardrobe_id, id, x, pics[x]!);
      await updateItem(id, change);
      if (sides.length) { await reload(); return close(); } // Kacheln, Farbschein und Detailbild neu laden
      const tile = wardrobe?.items.find((i) => i.id === id);
      const colorChanged = color !== orig!.color;
      patch(id, {
        name: change.name, brand: change.brand, category: change.category, ownerId: change.owner_id, price: price ?? list,
        qty, reversible: change.reversible, seasons: change.seasons, style: change.style, purchaseDate: date, color,
        hex: colorChanged ? nameToHex(color) ?? tile?.hex ?? null : tile?.hex ?? null,
      });
      close();
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove() {
    setConfirmDelete(false);
    try { await deleteItem(id); await reload(); router.dismissTo('/'); }
    catch (e) { toast.show('Löschen fehlgeschlagen: ' + (e as Error).message); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.bar, { paddingTop: insets.top + space.xs, borderBottomColor: t.hairline }]}>
        <Pressable onPress={close} hitSlop={10}><Text style={{ fontSize: 17, color: t.ink }}>Abbrechen</Text></Pressable>
        <Text style={{ fontFamily: DISPLAY, fontSize: 20, color: t.ink }}>Bearbeiten</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10}><Text style={{ fontSize: 17, fontWeight: '700', color: t.dark ? t.accent : '#722638', opacity: saving ? 0.4 : 1 }}>{saving ? 'Speichert …' : 'Sichern'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={s.col}>
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <PictureEdit title={f.reversible ? 'Seite A' : undefined} current={current.a} value={pics.a} onChange={(p) => setPics((x) => ({ ...x, a: p }))}
              category={f.category} color={tileHex ?? '#d8d2c8'} />
            {f.reversible && (
              <PictureEdit title="Seite B" current={current.b} value={pics.b} onChange={(p) => setPics((x) => ({ ...x, b: p }))}
                category={f.category} color={tileHex ?? '#d8d2c8'} />
            )}
          </View>
          <ItemFormFields f={f} onChange={setF} persons={wardrobe?.persons ?? []} open={open} onOpen={setOpen} />

          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignItems: 'center', paddingVertical: space.lg }}>
            <Text style={{ fontSize: 16, color: t.dark ? '#F2B8B5' : '#B3261E' }}>Teil löschen</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Teil löschen?"
        footer={<><SheetButton label="Abbrechen" onPress={() => setConfirmDelete(false)} /><SheetButton primary label="Löschen" onPress={remove} /></>}>
        <Text style={{ fontSize: 16, color: t.ink }}>„{orig.name}“ wird mit allen Tragetagen und aus allen Outfits entfernt. Das lässt sich nicht rückgängig machen.</Text>
      </Sheet>
      {toast.node}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  col: { width: '100%', maxWidth: 520, padding: space.md, gap: space.sm },
});
