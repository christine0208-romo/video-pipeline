#!/usr/bin/env node
/**
 * 项目包扫描：
 *   node run.mjs projects scan
 *
 * 扫描 projects/<id>/project.json，校验 id、目录与脚本入口。
 * 没有 projects/ 时视为空核心：打印 0 个项目并以 0 退出。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanProjects } from "../modules/lib/projects.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "scan";

if (command !== "scan") {
  console.log("用法：node tools/projects.mjs scan");
  process.exit(1);
}

const { projects, errors } = scanProjects(path.join(ROOT, "projects"));

for (const project of projects) {
  const entry = project.entry ? ` · ${project.entry}` : "";
  const scripts = project.scripts.length ? ` · ${project.scripts.length} 个脚本` : "";
  console.log(`${project.id}\t${project.name}\t${project.dir}${entry}${scripts}`);
}
for (const error of errors) console.error(`✗ ${error}`);
console.log(`[projects] ${projects.length} 个项目 / ${errors.length} 个问题`);
process.exit(errors.length ? 1 : 0);
