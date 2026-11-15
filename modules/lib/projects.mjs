import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const inside = (parent, child) =>
  child === parent || child.startsWith(parent + path.sep);

/**
 * 扫描 <root>/<id>/project.json。没有 projects/ 时返回空列表。
 * 项目包属于内容，不进核心仓库。
 */
export function scanProjects(root) {
  const projects = [];
  const errors = [];
  if (!existsSync(root)) return { projects, errors };

  const seen = new Set();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const manifestFile = path.join(dir, "project.json");
    if (!existsSync(manifestFile)) {
      errors.push(`${entry.name}/project.json 不存在`);
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    } catch (error) {
      errors.push(`${entry.name}/project.json 无法解析：${error.message}`);
      continue;
    }
    const id = manifest.id ?? entry.name;
    if (manifest.id && manifest.id !== entry.name) {
      errors.push(`${entry.name}/project.json 的 id=${manifest.id} 与目录名不一致`);
    }
    if (seen.has(id)) errors.push(`项目 id 重复：${id}`);
    seen.add(id);

    const scripts = [
      ...(manifest.entry ? [manifest.entry] : []),
      ...(Array.isArray(manifest.scripts) ? manifest.scripts : []),
    ];
    for (const script of scripts) {
      const target = path.resolve(dir, String(script));
      if (!inside(dir, target)) {
        errors.push(`${entry.name} 的脚本越出项目目录：${script}`);
      } else if (!existsSync(target)) {
        errors.push(`${entry.name} 的脚本不存在：${script}`);
      }
    }

    projects.push({
      id,
      name: manifest.name ?? id,
      dir: entry.name,
      manifestFile,
      entry: manifest.entry ?? null,
      scripts: Array.isArray(manifest.scripts) ? manifest.scripts : [],
      project: manifest,
    });
  }

  projects.sort((a, b) => a.id.localeCompare(b.id));
  return { projects, errors };
}
