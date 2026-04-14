import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_API_BASE =
  "https://api.github.com/repos/enthec/webappanalyzer/contents/src/technologies";
const OUT_FILE = "resources/enthec/technologies.json";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "AmplitudeLens-TechStack-Updater"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.json();
}

async function listTechnologyJsonFiles(apiUrl) {
  const items = await fetchJson(apiUrl);
  const files = [];

  for (const item of items) {
    if (item.type === "dir") {
      const nested = await listTechnologyJsonFiles(item.url);
      files.push(...nested);
      continue;
    }

    if (item.type === "file" && item.name.endsWith(".json")) {
      files.push({
        path: item.path,
        downloadUrl: item.download_url
      });
    }
  }

  return files;
}

function mergeTechnologies(existing, incoming) {
  const merged = { ...existing };
  for (const [name, definition] of Object.entries(incoming)) {
    if (!merged[name]) {
      merged[name] = definition;
      continue;
    }

    merged[name] = {
      ...merged[name],
      ...definition
    };
  }
  return merged;
}

async function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outputPath = path.join(rootDir, OUT_FILE);
  const outputDir = path.dirname(outputPath);

  const fileList = await listTechnologyJsonFiles(GITHUB_API_BASE);
  const technologies = {};

  for (const file of fileList) {
    const content = await fetchJson(file.downloadUrl);
    Object.assign(technologies, mergeTechnologies(technologies, content));
  }

  const mergedOutput = {
    source: "https://github.com/enthec/webappanalyzer",
    generatedAt: new Date().toISOString(),
    fileCount: fileList.length,
    technologyCount: Object.keys(technologies).length,
    technologies
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(mergedOutput, null, 2), "utf8");

  console.log(
    `Updated ${OUT_FILE} with ${mergedOutput.technologyCount} technologies from ${mergedOutput.fileCount} files.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
