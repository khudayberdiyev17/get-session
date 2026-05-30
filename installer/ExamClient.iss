; ============================================================
;  ExamClient — Inno Setup Installer Script
;  Build: iscc installer\ExamClient.iss
; ============================================================

#define AppName      "Exam Client"
#define AppVersion   "1.0.0"
#define AppPublisher "Exam System"
#define AppExeName   "ExamClient.exe"
#define DistDir      "..\client\dist"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=http://localhost
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputDir=Output
OutputBaseFilename=ExamClientInstaller
SetupIconFile=..\client\resources\icons\app.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "uzbek"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
uzbek.WelcomeLabel1=Exam Client o'rnatish ustasi
uzbek.WelcomeLabel2=Bu ustoz Exam Client %1 versiyasini kompyuteringizga o'rnatadi.%n%nDavom etishdan oldin barcha boshqa dasturlarni yoping.

[Tasks]
Name: "desktopicon"; Description: "Ish stoliga yorliq yaratish"; GroupDescription: "Qo'shimcha:"; Flags: unchecked
Name: "quicklaunchicon"; Description: "Tez ishga tushirish paneliga yorliq"; GroupDescription: "Qo'shimcha:"; Flags: unchecked; OnlyBelowVersion: 6.1

[Files]
; Main executable and all Qt DLLs collected by windeployqt
Source: "{#DistDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

; Configuration file (will be overwritten only if not exists)
Source: "..\client\config.ini"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\{#AppName}";          Filename: "{app}\{#AppExeName}"
Name: "{group}\{#AppName} o'chirish"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}";    Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Exam Client ni ishga tushirish"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\*.log"

[Code]
// Check for Visual C++ Redistributable
function VCRedistInstalled(): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(
    HKLM,
    'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
    'Version',
    Version
  );
end;

procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel1.Caption := 'Exam Client o''rnatishga xush kelibsiz';
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not VCRedistInstalled() then begin
    MsgBox(
      'Microsoft Visual C++ Redistributable (x64) topilmadi.'#13#10 +
      'Iltimos, avval VC++ Redistributable o''rnating:'#13#10 +
      'https://aka.ms/vs/17/release/vc_redist.x64.exe',
      mbInformation, MB_OK
    );
  end;
end;
