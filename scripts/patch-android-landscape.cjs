const fs = require('fs');
const path = require('path');

const manifestPath = path.join(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
);

if (!fs.existsSync(manifestPath)) {
  console.error(
    'AndroidManifest.xml was not found. Run "npx cap add android" first.',
  );
  process.exit(1);
}

const original = fs.readFileSync(manifestPath, 'utf8');

const activityMatch = original.match(
  /<activity\b(?=[^>]*\bandroid:name="\.MainActivity")[^>]*>/,
);

if (!activityMatch) {
  console.error(
    'Could not find the .MainActivity entry in AndroidManifest.xml.',
  );
  process.exit(1);
}

let activityTag = activityMatch[0];

if (/\bandroid:screenOrientation=/.test(activityTag)) {
  activityTag = activityTag.replace(
    /\sandroid:screenOrientation="[^"]*"/,
    ' android:screenOrientation="sensorLandscape"',
  );
} else {
  activityTag = activityTag.replace(
    /<activity\b/,
    '<activity android:screenOrientation="sensorLandscape"',
  );
}

const next = original.replace(activityMatch[0], activityTag);

if (next !== original) {
  fs.writeFileSync(manifestPath, next);
  console.log('Set MainActivity orientation to sensorLandscape.');
} else {
  console.log('MainActivity already uses sensorLandscape.');
}
