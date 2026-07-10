# public/placeholders/ — пусто по замыслу

Заглушки-ассеты Sunnyside **генерируются примитивами в коде**, не файлами (21-client §3.7).

- Формы и цвета заглушек описаны в мастер-реестре `src/assets/placeholders/registry.ts`
  (`placeholder: { shape, size, color }`), рисуются компонентом
  `src/assets/placeholders/PlaceholderMesh.tsx` (все 4 сцены — registry-converge, свой
  прежний мини-реестр `src/scene/assets/registry.ts`/`Prop.tsx` удалён).
- Палитра именованных цветов — `CANON_PALETTE` в самом реестре (единственный источник цвета).
- Финальные GLB: сейчас поле `final` реестра несёт только ТРЕБОВАНИЯ к финалу (Фаза D),
  механизм one-line-свапа на реальный путь GLB в `PlaceholderMesh` ещё предстоит завести.

Этот каталог зарезервирован под возможные растровые/спрайтовые заглушки; сейчас не нужен.
