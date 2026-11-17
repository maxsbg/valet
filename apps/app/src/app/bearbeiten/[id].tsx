// Teil bearbeiten (VALET_DETAILSEITE_SPEC.md, Abschnitte 7 und 7a)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { editChange, layoutKind, tileKind, toEditForm, type EditForm, type EditRow } from '@valet/core';
import { useToast } from '@/components/ui';
import { Sheet, SheetButton } from '@/components/Sheet';
import { ItemEditor } from '@/components/edit/ItemEditor';
import type { Picture } from '@/lib/cutout';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useBottomInset } from '@/lib/bottomInset';
import { loadItem, loadPictures, updateItem, deleteItem, saveImage, saveSet, type ItemRow } from '@/lib/item';
import type { SetDraft } from '@/components/edit/SetPicker';
import { nameToHex } from '@/lib/wardrobe';
import { colorHex } from '@valet/core';

export default function Bearbeiten() {
  const { id, reiter } = useLocalSearchParams<{ id: string; reiter?: string }>();
  const t = useTheme();
  const { wardrobe, session, patch, reload } = useSession();
  const [orig, setOrig] = useState<ItemRow | null>(null);
  const [f, setF] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [current, setCurrent] = useState<Record<'a' | 'b', string | null>>({ a: null, b: null });
  const [pics, setPics] = useState<Record<'a' | 'b', Picture | null>>({ a: null, b: null });
  // Set (entschieden 15.11.2026: wird in Bearbeiten gepflegt)
  const [setDraft, setSetDraft] = useState<SetDraft>({ on: false, members: [], name: '' });
  const [set0, setSet0] = useState<SetDraft | null>(null);
  const bottom = useBottomInset();
  const toast = useToast(bottom + 90);
  const me = wardrobe?.persons.find((p) => p.user_id === session?.user.id);

  useEffect(() => {
    loadItem(id).then((d) => { setOrig(d.item); setF(toEditForm(d.item as unknown as EditRow)); }).catch((e) => toast.show(e.message));
    loadPictures(id).then(setCurrent).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set-Teile erst, wenn Teil und Schrank geladen sind (beim direkten Öffnen kommt der Schrank später)
  useEffect(() => {
    if (!orig || !wardrobe || set0) return;
    const members = orig.set_id ? wardrobe.items.filter((i) => i.setId === orig.set_id && i.id !== id).map((i) => i.id) : [];
    const s0 = { on: !!orig.set_id, members, name: orig.set_name ?? '' };
    setSetDraft(s0); setSet0(s0);
  }, [orig, wardrobe, set0, id]);

  const tile = wardrobe?.items.find((i) => i.id === id);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/teil/${id}`));
  if (!f || !orig) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;

  async function save() {
    if (!f) return;
    const r = editChange(f);
    if ('error' in r) return toast.show(r.error);
    const c = r.change as Record<string, unknown> & { color: string };
    setSaving(true);
    try {
      // Neue Bilder zuerst, damit bei einem Fehler nichts halb gespeichert ist
      const sides = (['a', 'b'] as const).filter((x) => pics[x] && (x === 'a' || f.reversible));
      for (const x of sides) await saveImage(orig!.wardrobe_id, id, x, pics[x]!);
      await updateItem(id, c);
      // Set: geändert → speichern; Schalter aus oder kein weiteres Teil → Set aufgelöst
      const setChanged = !f.isWish && set0 && (setDraft.on !== set0.on || setDraft.name !== set0.name || setDraft.members.join() !== set0.members.join());
      if (setChanged) await saveSet(orig!.set_id, setDraft.on ? [id, ...setDraft.members] : [id], setDraft.name.trim() || null);
      if (sides.length || setChanged) { await reload(); return close(); } // Kacheln, Farbschein und Detailbild neu laden
      const colorChanged = c.color !== orig!.color;
      const firstHex = f.colors[0] ? colorHex(f.colors[0]) : null;
      patch(id, {
        name: f.name.trim(), brand: f.brand.trim(), category: f.category ?? '', subcategory: f.subcategory, type: f.type,
        kind: layoutKind(f.category, f.subcategory), size: tileKind(f.category, f.subcategory, f.type, f.fit.length), colors: f.colors, layers: f.layers, color: c.color,
        ...(f.isWish ? { wishlistId: f.wishlistId, wishTag: f.wishTag, shop: f.shop.trim() || null, listPrice: c.list_price as number | null, price: c.list_price as number | null }
          : { ownerId: c.owner_id as string | null, owners: f.owners, qty: f.qty, pricePaid: c.price_paid as number | null, listPrice: c.list_price as number | null,
            price: (c.price_paid ?? c.list_price) as number | null, purchaseDate: f.purchaseDate }),
        reversible: f.reversible, seasons: f.seasons, style: (c.style as string) || null,
        hex: colorChanged ? firstHex ?? nameToHex(c.color) ?? tile?.hex ?? null : tile?.hex ?? null,
      });
      close();
    } catch (e) { toast.show('Speichern fehlgeschlagen: ' + (e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove() {
    setConfirmDelete(false);
    try { await deleteItem(id); await reload(); router.dismissTo(f?.isWish ? '/wunschliste' : '/'); }
    catch (e) { toast.show('Löschen fehlgeschlagen: ' + (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ItemEditor title="Bearbeiten" form={f} onForm={setF} persons={wardrobe?.persons ?? []} meId={me?.id ?? null} wishlists={wardrobe?.wishlists ?? []}
        current={current} pics={pics} onPic={(side, p) => setPics((x) => ({ ...x, [side]: p }))} hex={tile?.hex ?? null}
        saving={saving} onCancel={close} onSave={save} onDelete={() => setConfirmDelete(true)} initialTab={reiter === 'kauf' ? 'kauf' : 'steck'}
        set={{ draft: setDraft, onChange: setSetDraft, items: wardrobe?.items ?? [], currentId: id, setId: orig.set_id }} />
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={f.isWish ? 'Wunsch löschen?' : 'Teil löschen?'}
        footer={<><SheetButton label="Abbrechen" onPress={() => setConfirmDelete(false)} /><SheetButton primary label="Löschen" onPress={remove} /></>}>
        <Text style={{ fontSize: 16, color: t.ink }}>„{orig.name}“ wird mit allen Tragetagen und aus allen Outfits entfernt. Das lässt sich nicht rückgängig machen.</Text>
      </Sheet>
      {toast.node}
    </View>
  );
}
