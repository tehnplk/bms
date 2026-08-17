import { execSync } from 'child_process';

try {
  const out = execSync(`powershell -NoProfile -Command "$sh = New-Object -ComObject WScript.Shell; $sc = $sh.CreateShortcut('C:\\Users\\Admin\\Desktop\\BMS Dev Portal HOSxP Test.lnk'); Write-Output ('TARGET:' + $sc.TargetPath); Write-Output ('WORKDIR:' + $sc.WorkingDirectory);"`).toString();
  console.log(out);
} catch(e) {
  console.error(e.message);
}
