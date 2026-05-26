const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async function stampWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.packager.projectDir;
  const rceditPath = path.join(
    projectDir,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit.exe',
  );
  const iconPath = path.join(projectDir, 'resources', 'icon.ico');
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);

  for (const filePath of [rceditPath, iconPath, exePath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing file needed to stamp Windows icon: ${filePath}`);
    }
  }

  execFileSync(rceditPath, [exePath, '--set-icon', iconPath], {
    stdio: 'inherit',
  });
};
