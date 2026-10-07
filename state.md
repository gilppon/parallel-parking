# 주차 게임 진행 상태

갱신: 2026-10-06

## Solarena 바이럴성 개선

- 주차 결과에서 별 수와 실제 각도 오차를 포함한 “같은 주차 공간 기록에 도전” 공유 링크를 만든다.
- 초대받은 플레이어는 친구 기록과 레벨을 메뉴에서 보고 `Try this bay`로 동일한 정적 레벨을 바로 시작한다. 차량 선택은 저장 진행 순서에 영향받을 수 있어 동일 차량/물리 리플레이를 약속하지 않는다.
- Poki SDK의 `shareableURL`을 사용할 수 있으면 사용하며, 일반 브라우저는 URL query fallback을 쓴다. Web Share 미지원 시 클립보드 복사.
- 확인: `npm run build` 통과(TypeScript + Vite, dist/index.html 1,578.56 kB / gzip 442.38 kB). `git diff --check` 통과.
- 실제 브라우저에서 Level 1·3별·0.6° challenge 링크를 열어 메뉴 기록 카드, `Try this bay`, 같은 레벨의 ready 화면/튜토리얼을 확인했다.
- 제한: 실제 자연 플레이 결과에서 공유 payload 생성/기기 공유·클립보드/Poki Inspector·SDK는 미검증. 콘솔에는 meta CSP `frame-ancestors` 경고가 한 건 있었다.
- 코드: `src/game/share.ts`, `src/App.tsx`, `src/ui/Screens.tsx`.
- 다음: 자연 결과를 만들어 공유 결과 화면을 확인하고, 같은 bay 재도전이 실제 플레이에서 잘 읽히는지 확인한다.


## Mobile menu usability fix — 2026-10-06

- Fixed menu clipping at 667×375 landscape caused by sizing an inner scroll limit against the unscaled canvas; removed that clipping limit and kept the content layer above non-interactive gradients.
- Verified in isolated browser screenshot at 667×375: Start, Stage Select, Garage and their labels were visible; Start opened Level 1's driving coach. Production build passed (1,579.45 kB / gzip 442.70 kB), `git diff --check` passed.


## Poki rewarded-action affordance — 2026-10-06

- Changed the free-coin ad action from lime to amber and labeled it with 🎬; the result double-coin action also names the ad and uses 🎬. Build passed (1,579.48 kB / gzip 442.71 kB), `git diff --check` passed.
