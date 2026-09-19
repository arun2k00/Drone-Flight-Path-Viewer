import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "public", "fonts");
fs.mkdirSync(out, { recursive: true });

const files = [
  ["@ibm/plex-sans", "IBMPlexSans-Regular.woff2"],
  ["@ibm/plex-sans", "IBMPlexSans-Medium.woff2"],
  ["@ibm/plex-sans", "IBMPlexSans-SemiBold.woff2"],
  ["@ibm/plex-mono", "IBMPlexMono-Regular.woff2"],
  ["@ibm/plex-mono", "IBMPlexMono-Medium.woff2"],
];
for (const [pkg, file] of files) {
  fs.copyFileSync(path.join(root, "node_modules", pkg, "fonts", "complete", "woff2", file), path.join(out, file));
}
fs.copyFileSync(
  path.join(root, "node_modules", "@ibm/plex-sans", "fonts", "complete", "woff2", "license.txt"),
  path.join(out, "IBM-Plex-OFL-LICENSE.txt"),
);
console.log(`Copied ${files.length} fonts to ${path.relative(root, out)}`);
