# react-roll-the-dice 최적화 조사

조사일: **2026-11-07, Asia/Seoul** · 버전: **0.1.1** · 기준 커밋: [`aeafc69c1083a480bc222df088a176d636d72533`](https://github.com/YeonSeong-Lee/react-roll-the-dice/tree/aeafc69c1083a480bc222df088a176d636d72533)

## 후속 구현 상태 — 2026-11-07

요청한 **§1·§2·§3은 구현했다.** 아래 조사 본문과 재현 부록은 위 기준 커밋의 기록이며, 부록의 lifecycle assertion은 수정 전 결함을 확인하기 위한 것이다. 현재 코드의 회귀 검증에는 `rtk proxy npm test`를 사용한다.

- **난수 경계:** `react-roll-the-dice/random`에 ESM/CJS·독립 타입 선언을 추가했다. React·CSS·client directive를 포함하지 않는다. 기존 루트 export는 유지하고 `forwardRef`의 PURE 주석을 빌드에 보존했다. 공개 subpath를 소비자 번들로 측정한 결과는 minified **367 B / gzip 263 B**다(esbuild 0.27.7, ESM/browser/minify, React external, `gzipSync` 기본 옵션). 루트에서 난수만 가져오는 경우 UI·CSS는 제거되지만 React import는 남는다. [구현](../../src/random.ts), [빌드 설정](../../tsup.config.ts), [패키지 회귀 테스트](../../tests/package.test.mjs)
- **종료·취소:** 활성 roll 토큰과 동기 cleanup으로 재굴림·`set()`·unmount를 처리한다. `set()`은 완료 콜백 없이 취소하며 throw 애니메이션도 중지한다. 종료 뒤 duration·미디어 설정 변경으로 완료가 다시 예약되지 않는다. 0ms 경로는 start 뒤 비동기로 완료하고 80ms grace를 적용하지 않는다. [구현](../../src/Dice.tsx), [회귀 테스트](../../tests/dice.test.mjs)
- **스타일:** 공개 `DiceStyles`를 한 번 렌더하고 각 Dice에 `injectStyles={false}`를 지정해 지원 버전 모두에서 한 스타일을 공유할 수 있다. nonce를 지정하면 일반 style 요소로 렌더해 SSR에서 보존하며, 없는 경우 기존 React 19 hoisting을 유지한다. 구현 중 React 17·18의 CSS 따옴표 HTML escaping으로 인한 hydration 실패도 재현해 수정했다. raw HTML로 전달하는 내용은 빌드에서 생성한 고정 CSS뿐이며 소비자 입력을 받지 않는다. [구현](../../src/DiceStyles.tsx), [SSR 테스트](../../tests/styles.test.mjs), [사용법](../../README.md#sharing-one-stylesheet)

검증 결과:

- Node **18.20.8**에서 전체 21개 테스트 통과. Node **22.23.4**에서 `npm test`의 빌드와 21개 테스트 통과. `typecheck`, `publint`, `attw` 통과(루트와 새 random 경로의 legacy/node16/bundler 타입 해석 포함).
- React **17.0.2**: DOM·SSR 테스트 16개 통과, 미지원 streaming API 테스트 1개 제외. React **18.3.1**: 17개 통과. React **19.2.8**: 전체 21개 통과. 공유 nonce 스타일의 hydration은 jsdom **26.1.0**에서 확인했다. `@types/react` **17.0.93**으로 두 공개 경로를 사용하는 TSX 소비자도 컴파일했다.
- 새 tarball을 임시 소비자에 설치해 Node 22에서 Vite **6.4.3**·Next **15.5.23** production build를 통과했다. Next의 prerender HTML에서 서버 측 난수 값, Dice 2개와 nonce style 1개를 확인했다. Vite는 client directive를 무시한다는 기존 방식의 경고를 출력했으며 빌드는 성공했다.
- 실제 브라우저의 CSS 애니메이션·paint 성능 및 CSP enforcement는 측정하지 않았다. inline style 속성을 차단하는 정책은 여전히 지원하지 않는다. React 17·18의 기본 자동 주입은 인스턴스별 스타일을 유지하므로 대량 렌더에서는 공유 경로를 선택해야 한다. §4~§7의 추가 최적화는 이번 구현 범위에 포함하지 않았다.

---

가장 확실한 개선 기회는 **난수 전용 import에 남는 컴포넌트·CSS를 분리하는 것**이다. 다음으로는 종료 콜백의 수명 관리와 React 버전별 스타일 전달을 정리할 가치가 있다. 번들 바이트, SSR 출력, 타이머 동작은 직접 확인했다. 반면 현재 애니메이션이 느리다거나 face 렌더링·미디어 쿼리·난수 할당이 실제 CPU 병목이라는 증거는 확보하지 않았다.

## 조사 범위와 판단 기준

- 대상: [src](../../src/), [tsup.config.ts](../../tsup.config.ts), [CSS 생성 스크립트](../../scripts/generate-css-module.mjs), [package.json](../../package.json), [예제](../../examples/), [Pages workflow](../../.github/workflows/pages.yml). 시작 작업 트리는 clean이었고, 저장소·상위 경로 및 관련 하위 경로에서 추가 `AGENTS.md`는 발견하지 못했다.
- 실행 환경: Node **26.0.0**, React **19.2.8**, tsup **8.5.1**, TypeScript **5.9.3**, 루트 esbuild **0.27.7**. 설치된 예제는 Vite **6.4.3** / Next **15.5.23**, React·ReactDOM **19.2.8**이다. Vite 예제 자체의 esbuild는 **0.25.12**여서 아래 루트 esbuild 측정과 구분한다.
- 추가 격리 환경: `/tmp`에 React·ReactDOM **17.0.2 / 18.3.1 / 19.2.8**, `react-test-renderer@19.2.8`을 정확한 버전으로 설치했다. 저장소 의존성·lockfile은 변경하지 않았다.
- 기존 공개 API, React `>=17.0.0`, Node `>=18`, ESM/CJS·타입 해석, SSR/CSP, reduced motion, 재굴림 계약을 보존하는 방향으로 평가했다. 지원 범위의 근거는 [package.json:25–70][pkg]와 [공개 타입][types]다. Node 18·CI의 Node 22 실행 및 React 17·18 타입 호환성은 이번 조사에서 검증하지 않았다.
- **실측**은 해당 실험 조건에서 관찰한 결과, **코드 관찰**은 실행 경로의 구조, **추정**은 추가 프로파일링이 필요한 효과를 뜻한다. 바이트 감소를 FPS·로딩 시간 개선으로 환산하지 않는다. 공식 문서는 조회일 기준이며, React 19.2.8 관련 차이는 해당 버전의 배포 소스·태그로 교차 확인했다. 라이브러리 API는 Context7 조회 후 공식 문서를 직접 확인했다.

## 먼저 실행할 우선순위

| 순서 | 작업 | 근거와 기대 효과 | 비용·선행 조건 |
|---|---|---|---|
| 1 | 난수 전용 subpath + 제거 가능한 컴포넌트 초기화 | 난수만 import해도 gzip **3,247 B**와 CSS·React import가 남음. 독립 소스는 **256 B**로 잠재 범위 확인. RSC 서버 호출 경계도 분리 | 중간. export·타입·번들 검증 필요. §1 |
| 2 | 활성 roll의 종료·취소 상태 정리 | `set()` 후 늦은 콜백, 종료 후 `duration` 변경만으로 중복 콜백을 재현 | 중간. `set()`의 취소 계약과 비동기 콜백 순서를 명확히 할 것. §2 |
| 3 | 버전별 스타일 경로와 CSP nonce 검증 | React 17·18의 반복 SSR 스타일, React 19.2.8의 nonce 누락 조건 확인 | 낮음~중간. 외부 CSS 사용 안내부터 시작하고 SSR 회귀를 확인. §3 |
| 4 | 현재 tarball을 사용하는 소비자 검증 정착 | 예제의 `0.1.0.tgz` 참조와 현재 `0.1.1` 간 차이, 제한된 CI 검증 범위 | 중간. 위 변경의 회귀 방지 및 개발 재현성 개선. §7 |
| 5 | 다수 인스턴스에서 face 렌더링 프로파일링 | 6면·21점 JSX 및 명암 계산이 반복됨. 비용이 큰지는 미측정 | 측정 후 채택. 작은 사용처에 일괄 memo를 추가하지 않음. §4 |

## 1. 난수 전용 진입점과 tree shaking — 높음

**관찰 사실.** [src/index.ts][entry]는 컴포넌트와 난수를 함께 재수출한다. [tsup 설정:33–48][build]은 단일 entry를 번들링한 뒤 ESM/CJS 전체에 `"use client"`를 붙인다. 원본 `dist/index.js:138`의 `forwardRef(...)` 호출에는 PURE 주석이 없었다. `sideEffects: ["**/*.css"]`는 이미 있지만, 난수 export를 쓰는 번들에서 이 호출과 연결된 CSS·JSX가 남는다. `sideEffects`는 모듈 제거, PURE 주석은 반환값이 사용되지 않는 호출 제거를 돕는 서로 다른 단서다. [esbuild 공식 설명][esbuild-annotations]

실측 조건은 esbuild 0.27.7, ESM/browser/minify, React 및 JSX runtime external, `gzipSync` 기본 옵션이다. 파일 전체 크기와 소비자 재번들 크기를 혼동하지 않도록 나눴다. 재현 코드는 부록 A에 있다.

| 배포 파일 자체 | 원본 B | gzip B |
|---|---:|---:|
| `dist/index.js` | 15,460 | 4,188 |
| `dist/index.cjs` | 15,661 | 4,201 |
| `dist/styles.css` | 11,540 | 3,372 |

| 소비자 ESM 재번들 | minified B | gzip B | `.rtd-scene` CSS / React import 잔존 |
|---|---:|---:|---|
| `Dice`만 배포 entry에서 재수출 | 10,353 | 3,246 | 있음 / 있음 |
| `rollDiceValue`만 배포 entry에서 재수출 | 10,361 | 3,247 | 있음 / 있음 |
| `rollDiceValue`만 `src/random.ts`에서 재수출 | 355 | 256 | 없음 / 없음 |
| 배포 entry의 `forwardRef` 호출에만 임시 PURE 주석 | 549 | 365 | 없음 / 있음 |

직접 소스 수치는 **공개 subpath 구현 후의 확정 크기가 아니다**. 임시 주석은 esbuild `onLoad`에서 메모리상으로만 적용했으며 실제 tsup 파이프라인에서 주석이 보존되는지는 미검증이다. React 자체 크기는 모든 행에서 제외했다. 이 esbuild 소비자 번들에서는 entry의 directive도 제거되므로, 이 결과로 RSC 호환성을 판정하면 안 된다.

**적용 조건과 변경안.** 난수만 사용하는 소비자 또는 RSC 서버 모듈에서 난수를 직접 호출하려는 경우 우선 적용한다. 기존 루트 export를 유지하면서 `react-roll-the-dice/random` 같은 별도 entry를 추가하고, 해당 ESM/CJS 및 선언 파일에 컴포넌트·스타일·client directive가 유입되지 않게 한다. 컴포넌트 진입점의 client 경계는 유지한다. 현재 루트 경로를 RSC 서버에서 일반 난수 함수처럼 호출하기 어렵다는 판단은 React의 client-module 규칙에 따른 것으로, 별도 Next 빌드로 재현한 결과는 아니다. 일반 Node의 함수 호출 금지를 뜻하지도 않는다. [React의 `use client` 경계][use-client]

`forwardRef` 초기화만 안전하게 제거 가능한 호출로 표시하거나 모듈 경계를 보존하는 빌드도 함께 검토한다. `rollDiceValue()` 자체는 난수를 소비하므로 무분별하게 PURE 대상으로 지정하지 않는다. CSS의 `sideEffects` 예외도 유지한다. `DiceValue`를 난수 선언 파일에서 참조할 때 [types.ts][types]의 React 타입 의존까지 따라오는지 확인해야 한다. 이 제안에서도 패키지의 React peerDependency는 유지된다.

**효과·위험·검증.** 전송·파싱 대상으로 남는 불필요한 코드는 실측됐다. 실제 앱의 시간 개선은 미측정이다. 비용은 export 및 빌드 변경 정도지만 CJS·선언 파일·RSC 경계가 회귀할 수 있다. 새 공개 경로를 설치한 소비자 번들에서 CSS와 React 런타임 import가 모두 사라지는지, 루트 `Dice` import는 그대로 동작하는지, `publint`/`attw`, Node import/require, Next 서버 측 난수 호출을 각각 확인한다. PURE 한 줄로 모든 경계 문제가 해결된다고 보지 않는다.

## 2. 종료 타이머와 즉시 결과 경로 — 높음

**관찰 사실.** [Dice.tsx:135–205][settle]에서 `set()`은 `rolling`을 false로 바꾸지만 `rollId`와 종료 effect를 취소하지 않는다. 종료 effect는 `rollId !== 0`이면 등록되고 `effectiveDuration` 변경 때도 재실행된다. `finish()`는 실행 시점의 `valueRef`와 최신 콜백을 사용한다. 다음은 React 19.2.8 test renderer, 가짜 시계, transition 이벤트를 자동 생성하지 않는 환경에서 확인한 결과다. 부록 C는 결과에 assertion을 걸어 재현한다.

| 시나리오 | 관찰된 결과 |
|---|---|
| `duration=100`, t=0 roll(결과 1), t=30 `set(6)` | t=30 `rolling=false`, 기존 타이머로 t=180 `onRollEnd(6)` |
| 위 duration으로 t=180 종료, 그때 `duration=200`으로 변경, 새 roll 없음 | t=460에 같은 값으로 `onRollEnd`가 다시 호출됨 |
| `duration=0` | t=79에도 `rolling=true`; t=80에 완료 콜백 |
| reduced motion=true, duration=1400, transition 이벤트 없음 | JS fallback은 마찬가지로 t=80에 완료 |
| t=0 roll(1), t=40 reroll(6) | start 두 번, 기존 타이머 취소, t=220 end(6) 한 번 |
| t=40에 새 `onRollEnd` 함수 전달 | 타이머는 연장되지 않고 t=180에 최신 함수 호출 |
| t=100 transform transitionend 후 fallback까지 진행 | end 한 번; 중복 방지 정상 |
| t=40 unmount | 종료 콜백 없음; 타이머·구독 정리 정상 |

처음 두 행은 단순 소스 추측을 넘어선 재현 결과다. 다만 `set()`이 진행 중 roll을 취소하는지 즉시 종료시키는지는 공개 계약에 명시돼 있지 않다. [현재 계약][readme-contract]은 roll마다 start, 최종 착지마다 end라고 설명한다. `set()` 후 바뀐 값으로 늦게 end를 보내는 동작을 유지할지 먼저 정하고 테스트로 고정하는 편이 좋다. 새 roll 없이 end가 반복되는 경로는 별도로 차단할 대상이다.

**변경안.** 활성 roll을 나타내는 토큰과 종료/취소 함수를 한곳에서 관리한다. reroll·set·unmount 때 이전 토큰을 무효화하고 timer/listener를 정리하며, `finish`는 현재 활성 토큰에만 반응하게 한다. 종료된 상태에서 duration 또는 reduced-motion 설정이 바뀌어도 새 완료를 예약하지 않도록 한다. 단순히 `set()`에서 `rollId`만 올리면 effect와 a/b 애니메이션을 다시 시작할 수 있으므로 취소 토큰과 시각적 phase는 구분한다. [phase와 종료 effect][dice]

0ms 경로는 80ms 여유 시간을 제거한 비동기 완료 작업을 검토한다. `roll()`의 동기 반환, start-before-end, 같은 갱신에 묶인 여러 roll의 최종 end 한 번을 유지하도록 토큰을 검사한다. 일반 애니메이션은 transition 이벤트와 fallback의 이중 안전장치를 유지한다. CSS 전환은 duration+delay가 0이면 시작되지 않는다는 규칙이 있어 이벤트만 기다릴 수 없다. [CSS Transitions 시작 조건][transitions]

**주의할 구분.** [reduced-motion CSS:373–380][motion-css]는 cube transition을 **1ms**로 덮어쓴다. 따라서 실제 브라우저에서는 JS duration이 0이어도 transitionend가 먼저 올 수 있다. 여기서 확인한 80ms는 **이벤트가 없는 가짜 시계의 fallback**이며, reduced motion의 실제 시각적 지연을 80ms로 측정한 것이 아니다. 실제 타이머는 스케줄링 지연도 있으므로 80ms 상한을 보장하지 않는다.

**효과·위험·검증.** 중복·늦은 콜백으로 소비자의 게임 상태나 렌더가 불필요하게 바뀌는 경로를 줄일 수 있다. FPS 개선이 아닌 정확성과 반응성 개선이다. 콜백 시점 변경은 호환성 위험이 있어 비용은 중간이다. 위 시나리오에 same-tick 연속 roll, 동일 값 재굴림, StrictMode, 키보드 입력, duration 중간 변경, 미디어 설정 변경, 브라우저 transitioncancel을 더해 확인한다. 최신 콜백 ref와 기존 재굴림 처리의 장점은 보존한다.

## 3. 스타일 전달: 다수 인스턴스·SSR·CSP — 높음, 사용 조건에 따라

**관찰 사실.** [DiceStyles.tsx][styles-component]의 동일 `href`·`precedence`는 React 19의 스타일 중복 제거 방식과 맞는다. 실제 `renderToString`으로 1/10/100개를 렌더했다. 아래는 그중 1/100개 결과이며 nonce prop은 모두 `research-nonce`로 동일하다. [React 공식 `<style>` 규칙][react-style]

| React / 주사위 수 | `<style>` 수 | HTML B | HTML gzip B |
|---|---:|---:|---:|
| 17.0.2 / 1 | 1 | 7,786 | 1,480 |
| 18.3.1 / 1 | 1 | 7,786 | 1,480 |
| 19.2.8 / 1 | 1 | 7,741 | 1,460 |
| 17.0.2 / 100 | 100 | 778,600 | 6,982 |
| 18.3.1 / 100 | 100 | 778,600 | 6,982 |
| 19.2.8 / 100 | 1 | 211,186 | 2,971 |

17·18의 반복 스타일은 압축으로 상당 부분 줄어든다. 원본 HTML 증가량을 그대로 네트워크 증가량이나 CSS 파싱 시간으로 간주하면 안 된다. 모든 버전에서 `injectStyles=false`, 100개는 style tag 0개, HTML 205,500 B/gzip 1,712 B였다. **이 수치에는 외부 CSS가 없으므로 동등한 스타일 완성 결과와의 총량 비교가 아니다.** DOM·CSSOM 메모리와 브라우저 파싱 시간도 측정하지 않았다.

`injectStyles=false`는 [렌더 분기][dice-render]만 끈다. 부록 A의 해당 prop을 고정한 소비자 번들에서도 CSS 문자열은 남았다(10,432 B/gzip 3,269 B; wrapper 포함이라 다른 entry와 직접 크기 비교용은 아님). JS에서 CSS를 제거하는 기능이라고 설명해서는 안 된다.

**CSP 관련 추가 실측.** React 19.2.8에서는 현재의 hoistable style에 `nonce` prop만 넘겨도 다음 차이가 있었다. 부록 B에서 SSR 출력과 streaming 출력을 직접 비교한다.

| 렌더러와 옵션 | 결과 style 태그에 nonce |
|---|---|
| React 17.0.2 / 18.3.1 `renderToString` | 있음 |
| React 19.2.8 `renderToString` | 없음, 개발 경고 발생 |
| React 19.2.8 `renderToPipeableStream`, renderer nonce 없음 | 없음 |
| 같은 renderer에 `nonce: 'research-nonce'` | 없음 |
| 같은 renderer에 `nonce: {script: 'research-nonce', style: 'research-nonce'}` | 있음 |
| React 19.2.8, `precedence` 없는 일반 `<style nonce=...>` | 있음 (`renderToString`) |

이는 React 19.2.8 소스의 [script/style nonce 분기][react-fizz-nonce]와 [hoisted style 검증][react-fizz-style], 현재 [streaming renderer 공식 API][react-stream]에서도 확인된다. React 19 전체 patch 버전 또는 Next의 내부 렌더러에서도 동일하다고 일반화하지 않는다. 이번 실험은 CSP 정책을 실제 브라우저에 적용한 검사가 아니다.

또한 주사위 한 개의 SSR HTML에는 **inline `style` 속성 28개**가 남는다(장면 1 + 면 6 + 점 21). 주입을 꺼도 동일하다. 따라서 nonce를 전달하거나 외부 CSS로 전환하는 것만으로 `style-src-attr 'none'`까지 만족한다고 볼 수 없다. style element와 style attribute는 별도 정책 대상이다. [렌더 코드][dice-render], [CSP3 `style-src-elem` / `style-src-attr`][csp]

**변경안.** 먼저 기존 API인 외부 `styles.css` import + 모든 Dice의 `injectStyles=false`를 React 17·18의 다수 인스턴스 사용처에 안내한다. SSR의 첫 출력에 CSS가 로드돼야 한다. 이후 필요하면 스타일을 import하지 않는 코어와 현재 자동 주입 wrapper를 분리하고 선택적 CSS-free subpath를 추가한다. 단순 prop 변경만으로 번들이 작아진다고 약속하지 않는다. 한 번만 렌더하는 공개 스타일 컴포넌트도 선택지다.

nonce가 필요한 기존 API를 유지하려면 `nonce`가 있을 때 일반 `<style>` 경로를 사용하는 방법을 검토할 수 있다. 이 경우 React 19 중복 제거를 잃으므로 명시적 단일 스타일 소유자나 외부 CSS와 함께 설계한다. 서버 renderer를 직접 제어할 수 있으면 같은 style nonce 옵션을 전달하는 방법도 있지만, 프레임워크별 검증을 전제로 해야 한다. 렌더 중 전역 `Set`을 바꾸거나 mount effect에서 `document.head`에만 주입하는 방식은 SSR 출력·요청 간 격리·첫 화면 스타일을 다시 해결해야 하므로 우선안으로 두지 않는다.

**효과·위험·검증.** 17·18 대량 SSR에서 반복 마크업을 줄일 여지가 확인됐다. React 19는 이미 dedupe하므로 단일 인스턴스·19 전용 앱에서 효과가 작을 수 있다. 변경 비용은 중간이며 style 순서·nonce·hydration 회귀가 주요 위험이다. 17/18/19에서 SSR→hydration, 1/100개, 여러 root·요청, mount/unmount, 자동/외부 CSS, nonce 및 실제 CSP를 확인한다. React 관리 스타일은 렌더 후 prop 변경을 무시할 수 있으므로 nonce를 클라이언트에서 뒤늦게 교체하는 설계에 의존하지 않는다. [React style 제약][react-style]

## 4. 고정 face/pip 구조와 명암 계산 재사용 — 측정 후 중간

**코드 관찰.** [Dice.tsx:237–283][dice-render]는 매 렌더에 `faceShades(value)`, 6면과 총 21점의 map, style 객체·gridArea 문자열 생성을 수행한다. [faces.ts:74–133][faces]의 명암 결과는 6개 값마다 고정돼 있다. 이것은 반복 계산의 존재를 보여주지만 매번 DOM 27개를 새로 만든다는 뜻은 아니다. 실제 update 시간은 측정하지 않았다.

**적용 조건과 변경안.** 수십~수백 Dice가 있고 부모가 같은 props로 자주 갱신되거나 roll 시작·완료 렌더의 비용이 관찰될 때 시도한다. 명암 6×6 테이블을 읽기 전용으로 미리 정의하고 내부 `DiceFaces`를 `value` 같은 최소 prop으로 분리해 memo하는 방안을 먼저 비교한다. CSS 변수의 상속을 유지하면 색상·크기 변경을 각 pip의 props로 복제할 필요가 없다. 공개 `Dice` 전체를 일괄 memo하거나 함수 prop을 무시하는 비교 함수를 추가하지 않는다. React memo는 props가 같을 때 유용하고, 새 객체·함수가 매번 들어오면 이득이 사라질 수 있다. [React memo][memo]

**효과·위험·검증.** JSX·객체 할당과 반복 명암 계산 감소는 예상 효과이며 개선 시간은 미측정이다. 비용은 낮음~중간이지만 테이블 오류로 조명이 바뀌거나 memo 경계에서 props 반영이 누락될 수 있다. 미리 계산하려고 모듈 최상위에 제거 불가능한 호출을 추가해 §1의 번들 문제를 재발시키지 않도록 한다. 1/10/100개, 안정적인 props/새 callback·style props, 부모 갱신/실제 roll을 분리해서 비교한다. `<Profiler>`의 commit별 `actualDuration`과 `baseDuration`, 할당량을 관찰하고 본래 6개 면의 명암·위치, ref·이벤트 동작을 확인한다. 일반 production 빌드에서는 Profiler가 비활성화되므로 측정용 profiling 빌드를 사용한다. [React Profiler][profiler]

## 5. reduced-motion 구독 공유 — 대량 마운트에서만 낮음

**관찰 사실.** [Dice.tsx:34–53][media-hook]은 인스턴스마다 `matchMedia`와 change listener를 만든다. 가짜 MQL을 사용한 100개 마운트에서 호출 100회·활성 listener 100개, unmount 후 0개를 확인했다. 실제 MQL 생성이나 이벤트 처리 시간은 측정하지 않았다. `matchMedia`가 새 MQL을 반환하고 변화 때 이벤트를 보내는 것은 [CSSOM View 규칙][media-spec]과도 맞는다.

**변경안과 조건.** 마운트가 빈번한 대규모 보드에서 비용이 확인된 경우에만 선택적 보드 단위 provider로 하나의 effect/listener와 context 값을 공유하고, provider 없는 기존 Dice는 현재 hook을 유지하는 설계를 검토한다. React 17 호환성과 기본 API를 유지할 수 있지만 API·구조가 늘어나는 대가가 있다. 작은 보드에서는 현재 구현을 유지하는 편이 합리적이다.

`useSyncExternalStore`를 React에서 곧바로 import하는 변경은 React 17 지원과 맞지 않는다. 이 hook은 React 18에 도입됐으며 SSR snapshot 일치도 요구한다. shim 도입은 런타임 의존성을 추가하지 않는 현재 정책과 함께 검토해야 한다. [React 18 도입 기록][react18], [SSR snapshot 규칙][sync-store]

**효과·위험·검증.** native listener 수 감소는 가능하나 화면의 Dice 상태 갱신 자체까지 없어지지는 않는다. 현재는 누수가 관찰되지 않았고 메모리·CPU 이득은 추정이다. 비용은 중간이다. StrictMode의 구독 정리, 최초 reduced 상태, 실행 중 설정 변경, provider 경계, SSR/hydration, 구형 `addListener` 경로를 검증한다. 미디어 쿼리를 모듈 import 시점에 읽지 않는다.

## 6. 난수 버퍼 재사용·대량 처리 — 낮음

**관찰 사실.** [random.ts:7–38][random]는 기본 난수 호출마다 `Uint8Array(1)`을 만들고 `crypto.getRandomValues`를 호출한다. 252~255는 거부하고 최대 8회 후 fallback을 사용한다. 부록 D에서 허용 바이트 0~251의 각 결과가 정확히 42개, 연속 거부 후 수용, 8회 거부 후 fallback, custom random의 crypto 우회를 확인했다. 통계 실험으로 난수의 품질을 증명한 것은 아니다.

**적용 조건과 변경안.** 시뮬레이션처럼 난수를 대량 생성하는 소비자에서 호출·할당 비용이 실제로 지배적일 때 작은 byte pool을 검토한다. 단일 클릭은 우선순위가 낮다. 풀에서도 252 이상을 거부하고 기존 custom random·재시도/fallback 계약을 유지해야 한다. 전체 byte에 `% 6`만 적용하면 첫 네 값은 43개, 나머지는 42개의 원상을 가져 공정성을 잃는다. 이는 현재 코드와 정수 구간의 직접 계산이다. WebCrypto는 제공한 정수 typed array를 채우며 한 호출의 길이를 65,536바이트로 제한한다. [WebCrypto 규격][webcrypto]

**효과·위험·검증.** 호출·할당 수 감소는 예상되지만 처리량 개선은 미측정이다. 풀은 상태와 테스트 복잡도를 늘리므로 우선 별도 실험에서 현재 방식과 비교한다. 1/1,000/60,000회, 기본/custom random, crypto 유무를 나누고 여러 번 실행한 중앙값 및 할당량을 기록한다. 풀 소진 경계, 251/252/255, 거부 횟수, fallback, 주입 RNG의 호출 순서를 확인한다. [Dice.roll][dice-roll]은 값 선택 외에 회전·yaw용으로도 주입 RNG를 호출하므로 시각적 난수까지 바꾸면 seeded 동작이 달라질 수 있다.

[Vite harness의 동기 60,000회 루프][harness]는 특수 진단 버튼 경로다. 그 루프의 대기 시간이 문제라면 harness의 청크 처리나 별도 worker를 검토할 수 있지만, 이를 일반 Dice 클릭의 병목 근거로 사용하지 않는다. 이 조사에서는 UI 정지 시간을 측정하지 않았다.

## 7. 소비자 빌드와 예제의 재현성 — 개발 효율 측면에서 중간

**관찰 사실.** [예제 Vite][vite-pkg]와 [예제 Next][next-pkg]는 모두 `react-roll-the-dice-0.1.0.tgz`를 참조한다. [예제 ignore 규칙][examples-ignore]은 lockfile을 제외한다. [Pages workflow:23–48][pages]는 Node 22에서 루트 `npm ci`→build→pack 후 Vite 예제의 tarball 경로를 현재 산출물로 바꾸고 `npm install`한다. 이 배포 경로는 최신 tarball을 사용하는 장점이 있지만, 로컬 예제는 별도 갱신 없이는 과거 파일을 가리킨다. 확인한 workflow에는 typecheck·패키지 lint·Next build·React 버전 matrix가 없다.

**변경안.** 현재 tarball을 임시 consumer에 설치하는 smoke 절차를 명시하고, ESM/CJS·새 subpath·타입 및 React 17/18/19 렌더를 검증한다. 배포와 별도로 Node 최소 지원 버전/CI 버전의 검증을 실행할 수 있게 한다. Vite·Next 예제의 설치 경로와 버전을 동기화하고 lockfile 정책을 정한다. 고정된 소비자 의존성을 먼저 `npm ci`로 설치한 뒤 새 tarball만 주입하는 임시 fixture도 선택지다. 단순히 현재 예제 명령을 `npm ci`로 치환하면 lockfile 부재 또는 manifest 불일치로 실패한다. [npm ci 공식 조건][npm-ci]

**효과·위험·검증.** 핵심 렌더러 속도 개선이 아니라, 이전 패키지를 측정하는 오류와 버전 변동·수동 준비 비용을 줄이는 작업이다. CI 소요 시간 절감은 측정하지 않았다. 비용은 중간이고 matrix 추가로 오히려 CI 시간이 늘 수 있다. 설치된 패키지 버전과 tarball hash, bundle entry 경로를 결과에 남기고 §1의 작은 소비자 번들 검사를 회귀 기준으로 둔다. Pages의 실제 tarball 소비 방식과 기존 `publint`/`attw` 검증은 유지한다.

## 유지할 설계와 보류할 최적화

- **CSS 중심 모션을 유지한다.** [transform transition 및 keyframes][css]가 회전·이동·확대와 shadow opacity를 처리한다. JS의 매 프레임 렌더 루프는 없다. transform/opacity 우선 접근은 브라우저 제작사의 [애니메이션 가이드][animation-guide]와 맞지만, 이것만으로 모든 기기에서 합성만 발생한다고 보장하지는 않는다.
- **a/b keyframe 이름을 무조건 합치지 않는다.** [phase 교대][css-replay]는 재굴림 때 애니메이션을 다시 시작하려는 장치다. 기존 이름과 매칭되면 재생 시간이 유지되고 새 이름은 새 애니메이션이 되는 [CSS Animations 규칙][css-animations]을 고려해야 한다. 원본 작성 중복을 줄이더라도 출력 이름과 재생 의미는 유지하고 브라우저에서 재굴림을 확인한다.
- **`will-change`, `translateZ(0)` 일괄 추가를 보류한다.** 레이어 강제 생성의 이득을 보여주는 trace가 없다. 특히 `contain: paint`를 preserve-3d 조상에 넣으면 평면화가 발생할 수 있고, 장면 밖으로 나가는 throw도 고려해야 한다. [브라우저 가이드][animation-guide], [CSS Transforms grouping 규칙][transforms]
- **CSS 압축만을 주요 개선으로 잡지 않는다.** 현재 내장 CSS는 5,613 B/gzip 1,168 B다. esbuild CSS minifier 실험은 5,382 B/gzip 1,160 B로 gzip 차이는 **8 B**였다. 이 수치는 별도로 복사되는 11,540 B 원본 CSS와 구분한다. [현재 생성기][css-generator]의 정규식 압축을 파서로 교체할 이유는 향후 문법 보존·유지보수일 수 있지만, 현 CSS에서 큰 전송 절감을 입증하지는 못했다.
- **모든 콜백에 memo, 회전 누적값의 주기적 초기화, canvas/WebGL 교체를 보류한다.** 현재 최신 콜백 ref·reroll effect cleanup·transition fallback·reduced CSS에는 명확한 목적이 있다. 회전값 초기화는 전진 회전 연속성을 깨뜨릴 수 있다. 대규모 재작성이나 프레임별 shadow 제거를 정당화할 프로파일은 없다. [Dice 구현][dice], [면 회전 설명][faces]

## 단계별 적용·검증 순서

1. **기준 고정:** 아래 재현 스크립트로 현재 바이트·SSR·콜백 결과를 기록한다. 실제 소비자 tarball, Node·React·bundler 버전을 함께 남긴다.
2. **경계 분리:** 난수 subpath와 필요한 PURE/module 분리를 각각 적용한다. 기존 API 유지, 소스맵·타입·ESM/CJS·RSC 서버 호출을 확인한다. 타이머와 스타일 변경은 별도 단위로 검토한다.
3. **동작 보존:** §2의 활성 roll 수명을 정리하고, §3의 nonce/스타일 경로를 적용한다. 아래 논리 실험에 더해 실제 SSR→hydration과 reduced motion·재굴림을 확인한다.
4. **측정 후 선택:** 1/10/100개 Dice에서 같은 값·props의 부모 갱신과 실제 roll을 분리한다. 워밍업 뒤 같은 시나리오를 반복하고 render 시간 중앙값·p95, 브라우저 style/layout/paint, 메모리를 비교한다. face 재사용→구독 공유→난수 pool 순서로, 확인된 비용만 줄인다. 성능 개선이 측정 편차보다 작으면 보류한다.

## 실행한 검사와 미검증 항목

| 검사 | 결과·측정 조건 | 이 결과가 보장하지 않는 것 |
|---|---|---|
| `rtk proxy npm run typecheck` | 조사 기초 검사에서 PASS | React 17·18 타입, Node 18·22 |
| `rtk proxy npm run build` | 조사 기초 검사에서 PASS; 해당 dist를 실험에 사용 | 새 export/annotation 변경 결과 |
| `rtk proxy npm run lint:pkg` | 조사 기초 검사에서 publint+attw PASS | 실제 렌더·CSP·RSC 함수 호출 |
| 번들·CSS 측정 | 두 차례 측정값 일치. PURE/prop 고정 실험 추가 | 실제 앱의 로딩·실행 시간 |
| React 17/18/19 SSR | 이번 조사에서 1/10/100개 및 injectStyles on/off 실행 | 브라우저 hydration, 전체 React 버전 호환 |
| React 19 nonce | `renderToString` 및 streaming 옵션별 실행, 출력 차이 확인 | Next 통합·실제 CSP enforcement |
| React 19 lifecycle·100개 구독 | 가짜 시계/MQL과 assertion으로 전부 확인 | 실제 CSS·paint, StrictMode, React 17/18 이벤트 경로 |
| 난수 경계 | 허용 바이트 전수·거부·fallback·주입 RNG assertion PASS | 암호학적 품질·브라우저 처리량 |
| 문서 검증 | 상대 링크·40개 출처 참조·실행한 스크립트 5개의 원문 일치 확인 | 외부 웹 문서의 향후 변경 |

`react-test-renderer`는 실행 시 deprecation 경고를 출력했다. 이번 격리된 논리 재현에만 사용했으며 제품 테스트 의존성 추가를 제안하는 것은 아니다. 본문 변경안은 구현하지 않았다. 문서 작성의 blocker는 없으며, 제품 성능 결정을 위한 브라우저 프로파일과 통합 호환성 검증이 남아 있다.

## 재현 부록

모든 명령은 저장소 루트에서 실행한다. `dist`와 `src/styles.generated.ts`가 없을 때만 먼저 `rtk proxy npm run build`를 실행한다. 이 조사의 실제 임시 경로는 `/tmp/rtd-research.qHPnPm`이었다. 아래 절차는 문서 자체에서 스크립트를 추출해 별도 `/tmp/rtd-optimization-repro`에 저장하므로 기존 임시 파일에 의존하지 않는다. 임시 의존성 설치에는 네트워크가 필요하다.

```sh
rtk proxy python3 - <<'PY'
from pathlib import Path
import re
doc = Path('docs/research/optimization-opportunities.md').read_text()
target = Path('/tmp/rtd-optimization-repro')
target.mkdir(exist_ok=True)
for name, code in re.findall(r'^```js file=([^\n]+)\n(.*?)^```$', doc, re.M | re.S):
    (target / name).write_text(code)
    print(target / name)
PY
rtk proxy npm install --prefix /tmp/rtd-optimization-repro/react17 --ignore-scripts --no-audit --no-fund react@17.0.2 react-dom@17.0.2
rtk proxy npm install --prefix /tmp/rtd-optimization-repro/react18 --ignore-scripts --no-audit --no-fund react@18.3.1 react-dom@18.3.1
rtk proxy npm install --prefix /tmp/rtd-optimization-repro/react19 --ignore-scripts --no-audit --no-fund react@19.2.8 react-dom@19.2.8 react-test-renderer@19.2.8
rtk proxy node /tmp/rtd-optimization-repro/measure-bundle.mjs
rtk proxy node /tmp/rtd-optimization-repro/measure-ssr.mjs
rtk proxy node /tmp/rtd-optimization-repro/measure-nonce.mjs
rtk proxy node /tmp/rtd-optimization-repro/measure-lifecycle.mjs
rtk proxy node /tmp/rtd-optimization-repro/check-random.mjs
```

### A. 소비자 번들과 CSS

```js file=measure-bundle.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
const require = createRequire(process.cwd() + '/package.json');
const { build, transform } = require('esbuild');
const sizes = value => ({ bytes: Buffer.byteLength(value), gzip: gzipSync(value).length });
for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/styles.css']) {
  console.log(JSON.stringify({ file, ...sizes(readFileSync(file)) }));
}
const cases = [
  ['Dice', "export { Dice } from './dist/index.js'"],
  ['RNG from root', "export { rollDiceValue } from './dist/index.js'"],
  ['RNG direct source', "export { rollDiceValue } from './src/random.ts'"],
  ['RNG with PURE experiment', "export { rollDiceValue } from './dist/index.js'"],
  ['injectStyles=false', "import {Dice} from './dist/index.js'; import {jsx} from 'react/jsx-runtime'; export const Manual = () => jsx(Dice,{injectStyles:false})"],
];
for (const [label, contents] of cases) {
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), sourcefile: 'measurement.js' },
    bundle: true, format: 'esm', platform: 'browser', minify: true, write: false,
    external: ['react', 'react/jsx-runtime'], logLevel: 'silent',
    plugins: label.includes('PURE') ? [{
      name: 'research-only-pure', setup(b) {
        b.onLoad({ filter: /\/dist\/index\.js$/ }, ({path}) => {
          const source = readFileSync(path, 'utf8');
          if (!source.includes('var Dice = forwardRef(')) throw Error('Bundle changed');
          return { contents: source.replace('var Dice = forwardRef(', 'var Dice = /* @__PURE__ */ forwardRef('), loader: 'js' };
        });
      },
    }] : [],
  });
  const code = result.outputFiles[0].text;
  console.log(JSON.stringify({label, ...sizes(code), CSS: code.includes('.rtd-scene'), react: /["']react(?:\/jsx-runtime)?["']/.test(code), client: code.includes('use client')}));
  if (label.includes('PURE')) console.log(code);
}
const generated = readFileSync('src/styles.generated.ts', 'utf8');
const css = JSON.parse(generated.match(/export const css = (".*")/)[1]);
console.log(JSON.stringify({label: 'embedded CSS', ...sizes(css)}));
console.log(JSON.stringify({label: 'esbuild minified embedded CSS', ...sizes((await transform(css, {loader: 'css', minify: true})).code)}));
```

### B. React 버전별 SSR와 nonce

같은 CJS 산출물을 각 임시 React 환경으로 복사한다. 라이브러리와 렌더러가 서로 다른 React 사본을 사용해서 생기는 invalid-hook 결과를 피하기 위한 것이다. `measure-ssr.mjs`를 먼저 실행해야 `measure-nonce.mjs`에서 사용하는 사본이 준비된다.

```js file=measure-ssr.mjs
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const base = dirname(fileURLToPath(import.meta.url));
for (const label of ['react17', 'react18', 'react19']) {
  const dir = join(base, label);
  copyFileSync('dist/index.cjs', join(dir, 'dice.cjs'));
  const require = createRequire(join(dir, 'package.json'));
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { Dice } = require('./dice.cjs');
  for (const count of [1, 10, 100]) {
    for (const injectStyles of [true, false]) {
      const html = renderToString(React.createElement(React.Fragment, null,
        ...Array.from({length: count}, (_, key) => React.createElement(Dice, {key, nonce: 'research-nonce', injectStyles})),
      ));
      console.log(JSON.stringify({
        React: React.version, count, injectStyles,
        tags: (html.match(/<style\b/g) || []).length,
        inlineAttributes: (html.match(/ style=/g) || []).length,
        bytes: Buffer.byteLength(html), gzip: gzipSync(html).length,
        firstStyle: html.match(/<style[^>]*>/)?.[0],
      }));
    }
  }
}
```

```js file=measure-nonce.mjs
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(dir, 'react19/package.json'));
const React = require('react');
const { renderToPipeableStream, renderToString } = require('react-dom/server');
const { Dice } = require('./dice.cjs');
const element = React.createElement('html', null, React.createElement('head'), React.createElement('body', null, React.createElement(Dice, {nonce: 'research-nonce'})));
for (const nonce of [undefined, 'research-nonce', {script: 'research-nonce', style: 'research-nonce'}]) {
  const html = await new Promise((resolve, reject) => {
    let html = '';
    const sink = new Writable({write(chunk, _encoding, done) {html += chunk; done();}});
    sink.on('finish', () => resolve(html)); sink.on('error', reject);
    const stream = renderToPipeableStream(element, {nonce, onAllReady() {stream.pipe(sink);}, onError: reject});
  });
  console.log(JSON.stringify({renderer: 'renderToPipeableStream', nonce: nonce ?? null, firstStyle: html.match(/<style[^>]*>/)?.[0]}));
}
console.log(JSON.stringify({renderer: 'renderToString plain style without precedence', html: renderToString(React.createElement('style', {nonce: 'research-nonce'}, '.x{}'))}));
```

### C. 종료 타이머와 구독 수

시계·MQL·cube listener는 mock이다. transition은 명시적으로 발생시킨 경우 외에는 생성하지 않는다. 이 스크립트는 **현재 동작을 재현하는 assertion**이므로 제품을 수정한 뒤에는 의도한 계약에 맞춰 기대값을 변경해야 한다. 별도 Node 프로세스로 실행하며 제품 프로세스에서 import하지 않는다.

```js file=measure-lifecycle.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = dirname(fileURLToPath(import.meta.url));
copyFileSync('dist/index.cjs', join(base, 'react19/dice.cjs'));
const require = createRequire(join(base, 'react19/package.json'));
const React = require('react');
const { create, act } = require('react-test-renderer');
const { Dice } = require('./dice.cjs');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let now = 0, nextId = 0, reduced = false, queries = 0;
const tasks = new Map(), subscribers = new Set();
globalThis.setTimeout = (fn, delay = 0) => {
  const id = ++nextId;
  tasks.set(id, {at: now + Number(delay), fn});
  return id;
};
globalThis.clearTimeout = id => tasks.delete(id);
globalThis.requestAnimationFrame = fn => setTimeout(() => fn(now), 16);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.window = {matchMedia() {
  queries++;
  return {matches: reduced, addEventListener: (_, fn) => subscribers.add(fn), removeEventListener: (_, fn) => subscribers.delete(fn)};
}};
async function advance(ms) {
  const target = now + ms;
  while (true) {
    const next = [...tasks].filter(([, t]) => t.at <= target).sort((a,b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, task] = next;
    tasks.delete(id); now = task.at;
    await act(() => task.fn());
  }
  now = target;
}
async function mount(props = {}) {
  now = 0; tasks.clear();
  const ref = React.createRef(), starts = [], ends = [], listeners = new Map();
  const cube = {addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)};
  const allProps = {ref, duration: 100, random: () => 0, onRollStart: value => starts.push([now, value]), onRollEnd: value => ends.push([now, value]), ...props};
  let renderer;
  await act(() => {renderer = create(React.createElement(Dice, allProps), {createNodeMock: element => element.props.className?.startsWith('rtd-cube') ? cube : null});});
  return {ref, starts, ends, listeners, cube, update: async more => {Object.assign(allProps, more); await act(() => renderer.update(React.createElement(Dice, allProps)));}, close: async () => {await act(() => renderer.unmount()); assert.equal(tasks.size, 0); assert.equal(subscribers.size, 0);}};
}
for (const isReduced of [false, true]) {
  reduced = isReduced;
  const x = await mount({duration: isReduced ? 1400 : 0});
  await act(() => {x.ref.current.roll();});
  await advance(79);
  assert.equal(x.ref.current.rolling, true); assert.deepEqual(x.ends, []);
  await advance(1);
  assert.equal(x.ref.current.rolling, false); assert.deepEqual(x.ends, [[80, 1]]);
  console.log(JSON.stringify({case: isReduced ? 'reduced fallback without CSS events' : 'duration=0', ends: x.ends}));
  await x.close();
}
reduced = false;
{
  const x = await mount();
  await act(() => {x.ref.current.roll();});
  await advance(30);
  await act(() => x.ref.current.set(6));
  assert.equal(x.ref.current.rolling, false);
  await advance(150);
  assert.deepEqual(x.starts, [[0, 1]]); assert.deepEqual(x.ends, [[180, 6]]);
  console.log(JSON.stringify({case: 'roll then set(6) at 30ms', starts: x.starts, ends: x.ends}));
  await x.close();
}
{
  const x = await mount();
  await act(() => {x.ref.current.roll();});
  await advance(180);
  await x.update({duration: 200});
  await advance(280);
  assert.deepEqual(x.ends, [[180, 1], [460, 1]]);
  console.log(JSON.stringify({case: 'duration changed after settle, without another roll', starts: x.starts, ends: x.ends}));
  await x.close();
}
{
  let randomValue = 0;
  const x = await mount({random: () => randomValue});
  await act(() => {x.ref.current.roll();});
  await advance(40); randomValue = 0.999;
  await act(() => {x.ref.current.roll();});
  await advance(140); assert.deepEqual(x.ends, []);
  await advance(40); assert.deepEqual(x.ends, [[220, 6]]);
  console.log(JSON.stringify({case: 'reroll at 40ms', starts: x.starts, ends: x.ends}));
  await x.close();
}
{
  const x = await mount(), latest = [];
  await act(() => {x.ref.current.roll();});
  await advance(40);
  await x.update({onRollEnd: value => latest.push([now, value])});
  await advance(140);
  assert.deepEqual(x.ends, []); assert.deepEqual(latest, [[180, 1]]);
  console.log(JSON.stringify({case: 'new callback at 40ms', latest}));
  await x.close();
}
{
  const x = await mount();
  await act(() => {x.ref.current.roll();});
  await advance(100);
  await act(() => x.listeners.get('transitionend')({target: x.cube, propertyName: 'transform'}));
  await advance(80); assert.deepEqual(x.ends, [[100, 1]]);
  console.log(JSON.stringify({case: 'transition then fallback', ends: x.ends}));
  await x.close();
}
{
  const x = await mount();
  await act(() => {x.ref.current.roll();});
  await advance(40); await x.close(); await advance(200);
  assert.deepEqual(x.ends, []);
  console.log(JSON.stringify({case: 'unmount during roll', ends: x.ends}));
}
{
  queries = 0; let renderer;
  await act(() => {renderer = create(React.createElement(React.Fragment, null, ...Array.from({length: 100}, (_, key) => React.createElement(Dice, {key}))));});
  assert.equal(queries, 100); assert.equal(subscribers.size, 100);
  console.log(JSON.stringify({case: '100 dice', queries, activeListeners: subscribers.size}));
  await act(() => renderer.unmount()); assert.equal(subscribers.size, 0);
}
console.log('PASS: all lifecycle observations asserted; no browser CSS/paint simulated.');
```

### D. 난수 경계

```js file=check-random.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const require = createRequire(process.cwd() + '/package.json');
const { transformSync } = require('esbuild');
const code = transformSync(readFileSync('src/random.ts', 'utf8'), {loader: 'ts', format: 'cjs'}).code;
let queue = [], calls = 0;
const customMath = Object.create(Math); customMath.random = () => 0.999;
const context = {module: {exports: {}}, Math: customMath, crypto: {getRandomValues(buffer) {calls++; buffer[0] = queue.shift() ?? 255; return buffer;}}};
runInNewContext(code, context);
const roll = context.module.exports.rollDiceValue;
const counts = [0, 0, 0, 0, 0, 0];
for (let byte = 0; byte < 252; byte++) {queue = [byte]; counts[roll() - 1]++;}
assert.deepEqual(counts, [42, 42, 42, 42, 42, 42]);
calls = 0; queue = [252, 253, 254, 255, 5];
assert.equal(roll(), 6); assert.equal(calls, 5);
calls = 0; queue = Array(8).fill(255);
assert.equal(roll(), 6); assert.equal(calls, 8);
calls = 0; assert.equal(roll(() => 0), 1); assert.equal(roll(() => 1), 6); assert.equal(calls, 0);
console.log(JSON.stringify({acceptedBytesPerFace: counts, rejectionSequence: 'PASS', eightRejectionsFallback: 'PASS', injectedRandomBypassesCrypto: 'PASS'}));
```

## 출처 링크

본문의 저장소 줄 번호는 기준 커밋에 고정했다. 외부 출처는 공식 문서·규격·라이브러리 자체 소스만 사용했다.

[pkg]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/package.json#L25-L70
[types]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/types.ts#L1-L40
[entry]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/index.ts#L1-L3
[build]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/tsup.config.ts#L18-L49
[dice]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/Dice.tsx#L55-L291
[dice-roll]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/Dice.tsx#L94-L133
[settle]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/Dice.tsx#L135-L205
[dice-render]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/Dice.tsx#L221-L288
[media-hook]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/Dice.tsx#L34-L53
[faces]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/faces.ts
[random]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/random.ts#L3-L38
[styles-component]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/DiceStyles.tsx#L1-L22
[css]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/styles.css
[css-replay]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/styles.css#L205-L221
[motion-css]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/src/styles.css#L373-L381
[css-generator]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/scripts/generate-css-module.mjs#L12-L25
[readme-contract]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/README.md#L74-L91
[harness]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/examples/vite-react/src/main.jsx#L15-L19
[vite-pkg]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/examples/vite-react/package.json#L10-L18
[next-pkg]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/examples/next-app/package.json#L9-L14
[examples-ignore]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/examples/.gitignore
[pages]: https://github.com/YeonSeong-Lee/react-roll-the-dice/blob/aeafc69c1083a480bc222df088a176d636d72533/.github/workflows/pages.yml#L23-L48
[esbuild-annotations]: https://esbuild.github.io/api/#ignore-annotations
[use-client]: https://react.dev/reference/rsc/use-client#caveats
[transitions]: https://www.w3.org/TR/css-transitions-1/#starting
[react-style]: https://react.dev/reference/react-dom/components/style#special-rendering-behavior
[react-fizz-nonce]: https://github.com/react/react/blob/v19.2.8/packages/react-dom-bindings/src/server/ReactFizzConfigDOM.js#L398-L411
[react-fizz-style]: https://github.com/react/react/blob/v19.2.8/packages/react-dom-bindings/src/server/ReactFizzConfigDOM.js#L3151-L3170
[react-stream]: https://react.dev/reference/react-dom/server/renderToPipeableStream#parameters
[csp]: https://www.w3.org/TR/CSP3/#directive-style-src-attr
[memo]: https://react.dev/reference/react/memo#should-you-add-memo-everywhere
[profiler]: https://react.dev/reference/react/Profiler#onrender-callback
[media-spec]: https://www.w3.org/TR/cssom-view-1/#dom-window-matchmedia
[react18]: https://react.dev/blog/2022/03/29/react-v18#usesyncexternalstore
[sync-store]: https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering
[webcrypto]: https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues
[npm-ci]: https://docs.npmjs.com/cli/v11/commands/npm-ci/#description
[animation-guide]: https://web.dev/articles/animations-guide#force_layer_creation
[transforms]: https://www.w3.org/TR/css-transforms-2/#grouping-property-values
[css-animations]: https://www.w3.org/TR/css-animations-1/#animations
