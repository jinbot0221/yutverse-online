# Intel Mac / Monterey에서 공개 주소 만들기

사용자가 확인한 환경: 2015 MacBook Pro, macOS 12.7.6, 실행 중인 Node.js v24.22.0. 현재 Node가 실행되므로 강제로 교체하지 않습니다. 다만 Node 24의 공식 macOS 지원은 13.5 이상이어서, 이 Mac에서 전체 서버까지 실행되는지 직접 확인해야 합니다. Node 22.23.5에서는 Linux에서 30개 테스트와 빌드가 통과했지만 현재 저장소의 버전 조건은 Node 24이며, 이 사실을 Mac 실기 검증으로 간주하지 않습니다.

## 기존에 저장소를 받은 경우

서버를 실행하던 터미널에서 Ctrl+C로 종료한 다음 저장소 폴더에서 실행합니다. `git pull`은 로컬 수정과 충돌하면 중단하며, 임의로 파일을 초기화하지 마세요.

```sh
cd ~/yutverse-online
git pull --ff-only origin main
npm ci
npm run build
npm run tunnel:install:mac
npm run deploy:quick
```

다른 폴더에 저장소를 받았다면 첫 줄의 경로를 변경합니다. 처음 받는 경우에는 `git clone https://github.com/jinbot0221/yutverse-online.git` 후 그 폴더로 이동합니다.

`deploy:quick`이 웹 서버도 시작하므로 별도로 `npm start`를 동시에 실행할 필요는 없습니다. 기본 공개용 서버 포트는 3003이고, 개발 서버의 3001과는 별개입니다. 이 실행기의 기본 데이터 파일은 `data/public/yutverse.sqlite`이며 기존 `data/yutverse.sqlite`와 공유하지 않습니다.

성공하면 `PUBLIC GAME URL: https://…trycloudflare.com`이 출력됩니다. 그 실제 주소를 친구들에게 공유하세요. 본인도 같은 주소로 들어간 뒤 온라인 개인전 → 이름 입력 → 방 생성 → 초대 코드 공유 → 전원 준비 → 방장 시작 순서로 진행합니다. 첫 실행 후 Mac에서 페이지·API·실제 3인 경기를 확인해야 배포 성공입니다.

명령 실행 중인 터미널을 열어 두고 Mac의 잠자기를 방지해야 합니다. 종료는 Ctrl+C입니다. 컴퓨터/터널을 끄면 주소는 동작하지 않고 다시 실행하면 주소가 바뀔 수 있습니다. 상시 고정 주소는 Named Tunnel과 별도 자동 실행 구성이 필요합니다.

## Mac 설치 스크립트가 하는 일

최신 공식 cloudflared Mac 실행 파일에서 최소 macOS 15를 확인했으므로 Monterey에 그 파일을 설치하지 않습니다. 대신 공식 Cloudflare 2025.11.1 소스의 고정 커밋 `17533b124c225c9090ef1de5cd2ee201e8c398e8`을 가져와 Go 1.25.14로 CGO 없이 빌드합니다. 해당 버전을 선택한 이유는 Go 1.24를 요구하는 소스여서 Monterey 지원 Go 도구체인으로 빌드할 수 있기 때문입니다. 최신 cloudflared 2026.11.0 소스는 Go 1.27.4를 요구합니다. 이는 최신 Cloudflare 버전으로의 업데이트가 아니며 장기 유지 시 지원되는 OS/최신 도구로 옮겨야 합니다.

- Go는 `go.dev` 공식 macOS Intel 아카이브를 고정 SHA256으로 검증한 뒤 저장소의 `.tools/monterey`에 설치합니다. 시스템 Node나 시스템 Go를 바꾸지 않습니다.
- Cloudflare 소스는 공식 GitHub 태그를 복제하고 실제 커밋과 변경 없는 상태를 검사합니다. 저장소에 포함된 vendor 의존성으로 빌드합니다.
- 설치 결과는 `.tools/cloudflared-monterey`와 빌드 해시 기록이며 Git에 올리지 않습니다. 공개 실행기는 실행 파일 해시를 확인합니다.
- 필요한 도구는 macOS 기본 `curl`, `tar`와 Git입니다. Git 실행 시 개발자 도구 설치 창이 뜨면 설치 후 다시 실행하세요.
- Linux에서 Intel Mac용 교차 빌드가 성공했고 Mach-O의 최소 macOS가 12.0임을 확인했습니다. 실제 Monterey에서의 실행·외부 연결은 아직 확인하지 못했습니다.
- 이 클라우드에서는 별도의 DNS/TCP 제한 때문에 공개 주소 발급이 차단되어 있습니다. 이 스크립트는 사용자의 Mac에서 실행하기 위한 것이며 제한을 우회하지 않습니다.

빌드나 실행이 실패하면 첫 오류 문구를 공유해 주세요. 인증서 검증을 끄거나 임의의 체크섬/OS 버전 패치를 적용하지 마세요.

### 설치 중 source commit mismatch가 나온 경우

초기 설치 스크립트가 주석 태그 자체의 객체 ID를 소스 커밋으로 잘못 비교하던 오류를 수정했습니다. 2025.11.1의 태그 객체는 `690f20c008b4b6d2f12756618b9136ef6d5e2f18`, 실제 커밋은 `17533b124c225c9090ef1de5cd2ee201e8c398e8`입니다. 이제 둘을 각각 검증합니다. 저장소에서 `git pull --ff-only origin main` 후 `npm run tunnel:install:mac`을 다시 실행하세요. 정상적으로 받아둔 Go와 소스를 재사용하며 `.tools` 폴더를 지울 필요가 없습니다.
