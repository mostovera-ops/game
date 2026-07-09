"""
Драйвер для headless-сборки: прогоняет blender_scene_scripts.py (01–07),
затем tools/08_export.py. Запуск:

    /home/user/blender-venv/bin/python tools/_build_and_export.py

Не часть игры — вспомогательный скрипт для генерации ассетов без GUI Blender.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_file(path):
    src = open(path, encoding="utf-8").read()
    g = {"__name__": "__main__", "__file__": path}
    exec(compile(src, path, "exec"), g)


print("=" * 60)
print("СБОРКА СЦЕНЫ из tools/blender_scene_scripts.py (01→07)")
print("=" * 60)
run_file(os.path.join(ROOT, "tools", "blender_scene_scripts.py"))

import bpy  # noqa: E402
print("\n[build] объектов в сцене:", len(bpy.data.objects))

print("\n" + "=" * 60)
print("ЭКСПОРТ через tools/08_export.py")
print("=" * 60)
run_file(os.path.join(ROOT, "tools", "08_export.py"))
