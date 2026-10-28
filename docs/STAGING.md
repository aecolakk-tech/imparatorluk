# Staging (kopya) dünya — Test Botu için

Canlı dünya (`world_state` id=1, Supabase) **hiç** kullanılmaz. Staging dünya yalnızca yerel bir dosyadır:
`staging/world.json` (git'e girmez).

| Komut | Ne yapar |
|---|---|
| `npx tsx scripts/staging.ts init /workspace/backups/world-pre-v202-deploy.json` | Son canlı yedeğin **kopyasını** alır (planlı çıkarma `landReal` silinir) ve “Test Botu” oyuncusunu ekler. Argümansız: yeni dünya. |
| `npx tsx scripts/staging.ts run 3` | Test Botu 3 oyun günü boşta oynar (sanal saat; yer/içer/uyur/çalışır). |
| `npx tsx scripts/staging.ts status` | Gün, nüfus, hazine, Test Botu'nun durumu. |
| `npx tsx scripts/staging.ts mock` | `staging/mock-store.json` üretir. Tarayıcıda `npm run dev -- --mode mock` açıp konsolda `localStorage.setItem('imparatorluk-mock-v1', <dosya içeriği>)` → sayfayı yenileyin: staging dünya arayüzde oynanır. |
| `npx tsx scripts/staging.ts reset` | Staging dünyayı siler; sonra yeniden `init`. |

Script kimlik bilgisi okumaz, ağa çıkmaz; sadece `src/server/core.ts` sim kodunu yerel dosya üzerinde çalıştırır.
