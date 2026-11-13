# 공개 배포 상태와 재개 방법

현재 **공개 배포 미완료**입니다. 공개 URL은 아직 발급·검증되지 않았습니다.

## 현재 클라우드에서 확인한 사항

- Node 24의 프로덕션 웹 + API 서버를 시작하고 `/api/health` 응답을 확인했습니다.
- 공식 Cloudflare 릴리스 2026.11.0의 Linux x86_64 실행 파일을 설치했으며, 공식 릴리스에 게시된 SHA256 `51f7c68b57ed7269164075d7e789efce5b59355982f06392deeb037d982a51fd`와 대조했습니다.
- `curl https://api.trycloudflare.com/` 요청은 환경 프록시의 HTTP 403으로 거부되었습니다.
- 실제 `cloudflared` 실행은 `api.trycloudflare.com` DNS 조회가 거부되어 종료되었습니다.
- 실행기는 터널 실패 시 자신이 시작한 프로덕션 서버도 종료했습니다. 기존 개발 서버나 DB는 종료·삭제하지 않았습니다.
- 환경 초안에 Cloudflare 관련 HTTP 도메인을 저장했습니다. 초안 저장은 실제 네트워크 적용이나 공개 URL 발급이 아닙니다.

## 필요한 네트워크

환경 설정에서 초안의 도메인 허용을 검토하고 저장해야 합니다. Quick Tunnel API에 `api.trycloudflare.com:443`, 생성 주소 검증에 `*.trycloudflare.com:443` 접근이 필요합니다.

Cloudflare Tunnel 자체는 HTTP 프록시의 도메인 허용만으로 동작하지 않습니다. HTTP/2 모드에서 `region1.v2.argotunnel.com`, `region2.v2.argotunnel.com`으로 **아웃바운드 TCP 7844** 연결과 정상 DNS 조회가 필요합니다. 이 클라우드의 현재 TCP 허용 목록은 비어 있습니다. TCP/DNS 통신을 지원하지 않는 실행 환경이면 MacBook 또는 터널을 지원하는 서버로 옮겨야 합니다. 정책을 우회하거나 인증서 검증을 끄지 않습니다.

공식 요구 사항: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/

## 재개 명령

저장소 루트에서 실행합니다.

```sh
npm ci
npm run build
npm run tunnel:install
npm run deploy:quick
```

이 설치 스크립트는 검증한 Linux x86_64 바이너리만 설치합니다. Mac 설치는 실제 macOS/Node 호환성을 먼저 확인해야 합니다.

`deploy:quick`은 다음을 수행합니다.

1. Node 버전·웹 빌드·Cloudflare 실행 파일 해시를 검사합니다.
2. 비어 있는 루프백 포트 3003에 프로덕션 서버를 시작합니다. 이미 포트가 사용 중이면 기존 프로세스를 종료하지 않고 실패합니다.
3. `/api/health` 준비 완료를 확인하고 Quick Tunnel을 요청합니다.
4. 터널 연결 등록 후 생성 주소의 HTTPS 웹·API·Socket.IO 핸드셰이크를 확인합니다.
5. 검증이 성공했을 때만 `PUBLIC GAME URL: https://…trycloudflare.com`을 출력합니다. URL은 전적 DB 디렉터리의 `public-url.txt`에도 기록합니다.
6. 터널 실패·60초 연결 시간 초과·Ctrl+C 시 자신이 시작한 프로세스를 종료합니다.

기본 공개용 DB는 `data/public/yutverse.sqlite`로 개발용 DB와 분리됩니다. 경로는 `YUTVERSE_PUBLIC_DATA_DIR`, 포트는 `YUTVERSE_PUBLIC_PORT`로 변경할 수 있습니다. 기존 데이터를 삭제하거나 덮어쓰지 않습니다.

URL 파일은 지난 성공 시도의 기록일 수 있으므로 현재 프로세스와 실제 응답을 확인해야 합니다. 등록·API·Socket.IO 초기 연결 확인 후, 실제 공개 주소로 `YUTVERSE_URL=https://발급주소 npm run test:browser`를 실행해 다중 브라우저 게임 흐름을 검증합니다. 이 테스트는 게스트와 경기 전적을 생성하므로 테스트 전용 DB를 사용하세요.

## 임시 주소의 수명

Quick Tunnel은 계정/도메인 없이 발급되는 임시 주소입니다. 프로세스나 클라우드 환경을 종료하면 접속이 끊기고, 재실행 시 주소가 바뀔 수 있습니다. 상시 운영은 실제 MacBook의 OS/Node 지원을 확인한 뒤 고정 도메인의 Named Tunnel과 프로세스 자동 재시작을 구성해야 합니다. 현재 MacBook 연결 정보나 Cloudflare 계정 자격 증명은 제공되지 않았으며 그 시스템에는 배포하지 않았습니다.
