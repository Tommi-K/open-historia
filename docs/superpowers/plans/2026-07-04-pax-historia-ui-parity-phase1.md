# Pax Historia UI Parity — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** open-paxhistoria의 설정 아이콘/국가 표시 위치를 실제 Pax Historia와 맞추고, 커뮤니티 허브 카드에 커버 이미지와 클릭 시 상세보기를 추가한다.

**Architecture:** 기존 컴포넌트(`SettingsButton`, `Other`, `CommunityPanel`)를 확장하는 방식. 새 전역 상태나 라우팅을 도입하지 않고, 기존 useState 기반 인플레이스 전환 패턴을 그대로 따른다.

**Tech Stack:** React 19, 인라인 style 객체(이 코드베이스의 기존 컨벤션 — CSS 모듈이나 styled-components 없음).

## Global Constraints

- 이 프로젝트에는 자동화된 테스트 스위트가 없다(jest/vitest 등 전무, 확인 완료). 모든 "테스트" 단계는 `npm run build` + `npm run lint` 통과와 `npm run dev`(포트 5173) + `node server/server.js`(포트 3000) 로컬 구동 후 브라우저 수동 확인으로 대체한다.
- 기존 코드 스타일을 따른다: 인라인 style 객체, 함수형 컴포넌트, 새 파일에는 한국어 한 줄 주석(팀장님 CLAUDE.md 컨벤션)은 이 저장소가 영어 주석 컨벤션(`/*! Open Historia — ... */` 헤더, 영어 인라인 주석)을 이미 확립했으므로 기존 파일 수정 시에는 기존 언어(영어) 컨벤션을 따르고 새로 만드는 설명은 최소화한다.
- 커밋은 논리적 단위로 분리한다(Task당 최소 1커밋).

---

## Task 1: 설정 버튼 아이콘을 "⋮"로 교체

**Files:**
- Modify: `src/Game/GameUI/settings.jsx:628-643` (`SettingsButton` 컴포넌트)

**Interfaces:**
- Consumes: 없음 (독립적인 시각적 변경)
- Produces: 없음 (다른 태스크가 의존하지 않음)

- [ ] **Step 1: 현재 코드 확인**

`src/Game/GameUI/settings.jsx`의 `SettingsButton`은 다음과 같다:

```jsx
const SettingsButton = ({ onToggle, topOffset = "0.5rem" }) => (
    <button
    onClick={onToggle}
    style={{
        ...baseStyle,
        top: topOffset,
        left: "0.5rem",
        height: "4rem",
        width: "4rem",
        cursor: "pointer",
        fontSize: "1.5rem",
    }}
    >
    ⚙️
    </button>
);
```

- [ ] **Step 2: 이모지를 "⋮"로 교체**

`⚙️`를 `⋮`로 바꾼다. `⋮`는 이모지가 아닌 일반 문자라 `fontSize: "1.5rem"`만으로는 `⚙️`보다 작게 보일 수 있으므로 `fontSize`를 `"1.8rem"`으로, `fontWeight: 700`을 추가해 클릭 대상임이 분명히 보이도록 한다:

```jsx
const SettingsButton = ({ onToggle, topOffset = "0.5rem" }) => (
    <button
    onClick={onToggle}
    style={{
        ...baseStyle,
        top: topOffset,
        left: "0.5rem",
        height: "4rem",
        width: "4rem",
        cursor: "pointer",
        fontSize: "1.8rem",
        fontWeight: 700,
    }}
    >
    ⋮
    </button>
);
```

- [ ] **Step 3: 로컬 구동 후 확인**

```bash
npm run dev
```
(다른 터미널에서 `node server/server.js`가 이미 실행 중이어야 함 — 그렇지 않으면 `/api/*` 호출이 실패한다.)

브라우저에서 아무 게임에 진입해 좌상단 버튼이 "⋮"로 보이는지, 클릭 시 기존과 동일하게 설정 메뉴가 열리는지 확인한다.

- [ ] **Step 4: 빌드/린트 확인**

```bash
npm run build
npm run lint
```
둘 다 에러 없이 통과해야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/Game/GameUI/settings.jsx
git commit -m "feat(ui): 설정 버튼 아이콘을 ⚙️에서 ⋮로 교체 (Pax Historia UI 정합)"
```

---

## Task 2: 국가 표시를 좌상단 텍스트에서 우하단 국기 배지로 교체

**Files:**
- Modify: `src/Game/GameUI/other.jsx` (전체 재작성 — 파일이 60줄로 작아 부분 수정보다 전체를 다시 쓰는 편이 안전)
- Modify: `src/Game/GameUI/main.jsx:277` (`<Other topOffset={TOP_BAR_OFFSET} />` 호출부 — `rightShift` prop 추가)

**Interfaces:**
- Consumes: `flagImageUrlFromGid(gid0)`, `flagEmojiFromGid(gid0)` (from `src/runtime/countryFlags.js`, 이미 존재, 시그니처: `(gid0: string) => string | null`), `useCountryDisplayName(code)` (from `src/runtime/polityNames.js`, 이미 존재)
- Produces: 없음 (leaf 컴포넌트)

**배경 확인 사항** (이미 코드 확인 완료):
- `flagImageUrlFromGid("HRE")` → `null` (ISO 코드가 아니므로). `flagEmojiFromGid("HRE")` → `null`. 즉 커스텀 정치체는 두 함수 모두 `null`을 반환하므로 이 값으로 폴백 분기가 가능하다 — 별도의 "이게 커스텀 정치체인지" 판별 로직이 필요 없다.
- 우하단은 이미 `AdvisorButton`이 차지하고 있다 (`src/Game/GameUI/main.jsx:167-174`, `bottom: "0.5rem", right: rightShift, height: "4rem", width: "4rem"`, `rightShift`는 기본 `"0.5rem"`이고 어드바이저 패널이 열리면 `calc(20rem + 0.5rem)`로 바뀜 — `main.jsx:250`). 새 국기 배지는 이 버튼과 겹치지 않도록 그 바로 위에 쌓는다: `bottom: "4.75rem"` (어드바이저 버튼의 `0.5rem + 4rem = 4.5rem` 상단 끝 + `0.25rem` 여백), 같은 `right: rightShift`를 받아 어드바이저 패널이 열려도 같이 움직이게 한다.

- [ ] **Step 1: `other.jsx` 전체를 다음으로 교체**

```jsx
/*! Open Historia — portions (mobile country/date row) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React, { memo, useEffect, useState } from "react";
import { JSON_URLS, readJson } from "../../runtime/assets.js";
import { useIsMobile } from "../../runtime/useIsMobile.js";
import { useCountryDisplayName } from "../../runtime/polityNames.js";
import { flagEmojiFromGid, flagImageUrlFromGid } from "../../runtime/countryFlags.js";

const baseStyle = {
    position: "fixed",
    backgroundColor: "rgba(17, 24, 39, 0.9)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontFamily: "sans-serif",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)",
};

// A GID_0 that isn't a real ISO country (custom scenario polities like "HRE",
// "YUAN") has no flag — flagImageUrlFromGid/flagEmojiFromGid both return null
// for it, which this component uses directly as the fallback signal instead
// of maintaining a separate "is this a real country" check.
const FallbackBadge = ({ label }) => (
    <div
    title={label}
    style={{
        alignItems: "center",
        backgroundColor: "rgba(75, 85, 99, 0.9)",
        borderRadius: "50%",
        color: "white",
        display: "flex",
        fontSize: "1.1rem",
        fontWeight: 700,
        height: "100%",
        justifyContent: "center",
        width: "100%",
    }}
    >
    {label ? label.trim().charAt(0).toUpperCase() : "?"}
    </div>
);

const Other = memo(function Other({ rightShift = "0.5rem" }) {
    const [country, setCountry] = useState(null);
    const [imageFailed, setImageFailed] = useState(false);
    const isMobile = useIsMobile();
    // The player sees the FULL country name in the tooltip, never the code.
    const displayName = useCountryDisplayName(country);

    useEffect(() => {
        readJson(JSON_URLS.game, { defaultValue: {} })
        .then((data) => setCountry(data.country))
        .catch((err) => console.error("Failed to load game.json:", err));
    }, []);

    useEffect(() => {
        setImageFailed(false);
    }, [country]);

    // On phones the country is already shown inside the date widget — this
    // badge and the date widget would overlap on a portrait screen.
    if (isMobile || !country) return null;

    const flagUrl = flagImageUrlFromGid(country);
    const flagEmoji = flagEmojiFromGid(country);

    return (
        <div
        title={displayName}
        style={{
            ...baseStyle,
            bottom: "4.75rem",
            right: rightShift,
            height: "2.75rem",
            width: "2.75rem",
            padding: "0.35rem",
            boxSizing: "border-box",
            transition: "right 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
        }}
        >
        {flagUrl && !imageFailed ? (
            <img
            src={flagUrl}
            alt={displayName}
            onError={() => setImageFailed(true)}
            style={{ borderRadius: "50%", height: "100%", objectFit: "cover", width: "100%" }}
            />
        ) : flagEmoji ? (
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{flagEmoji}</span>
        ) : (
            <FallbackBadge label={displayName} />
        )}
        </div>
    );
});

export { Other };
```

- [ ] **Step 2: `main.jsx`에서 `Other` 호출부를 `rightShift`를 넘기도록 수정**

`src/Game/GameUI/main.jsx:277` 현재:
```jsx
<Other topOffset={TOP_BAR_OFFSET} />
```
다음으로 교체:
```jsx
<Other rightShift={rightShift} />
```
(`rightShift`는 이미 같은 파일 250번째 줄에서 `const rightShift = isAdvisorOpen ? ... : "0.5rem";`로 계산되어 `AdvisorButton`/`DateWidget`/`ForcesPanel`에 이미 전달되고 있는 값이다 — 새 계산 불필요.)

- [ ] **Step 3: 로컬 구동 후 확인**

일반 시나리오(예: Modern Day, RUS/USA 등 실제 ISO 국가)로 게임 진입 → 우하단, 어드바이저 버튼(🧭) 바로 위에 국기가 보이는지 확인. 마우스를 올리면 전체 국가명이 툴팁으로 보이는지 확인.

커스텀 정치체 시나리오(예: `medieval-1200` 프리셋을 커뮤니티 허브에서 가져와 HRE로 플레이, 또는 `cheats.jsx`의 "Your Country" 치트로 country를 "HRE"나 존재하지 않는 코드로 바꿔 테스트)로 진입 → 국기 대신 원형 글자 배지(예: "H")가 보이는지 확인.

어드바이저(🧭) 버튼을 눌러 패널을 열었다 닫았다 하며 국기 배지가 어드바이저 버튼과 같이 좌우로 이동하는지(겹치지 않는지) 확인.

모바일 너비(예: 375px)로 브라우저 창을 리사이즈 → 국기 배지가 사라지고 기존처럼 날짜 위젯에 국가 표시가 통합되는지 확인(이 동작은 `time.jsx`가 담당하며 이번 변경으로 건드리지 않았으므로 회귀가 없어야 정상).

- [ ] **Step 4: 빌드/린트 확인**

```bash
npm run build
npm run lint
```

- [ ] **Step 5: 커밋**

```bash
git add src/Game/GameUI/other.jsx src/Game/GameUI/main.jsx
git commit -m "feat(ui): 국가 표시를 좌상단 텍스트에서 우하단 국기 배지로 교체 (Pax Historia UI 정합)

커스텀 정치체(HRE 등 실제 국기가 없는 경우)는 국가명 첫 글자 원형
배지로 폴백한다."
```

---

## Task 3: 커뮤니티 허브 카드에 커버 이미지 추출/표시

**Files:**
- Modify: `src/Game/GameUI/communityHub.jsx:59-91` (`parsePost` 함수), `:165-230` (`ScenarioCard` 컴포넌트)

**Interfaces:**
- Consumes: 없음 (기존 `issue.body` 문자열 파싱만 추가)
- Produces: `post.coverImageUrl: string | null` — Task 4에서 상세보기가 이 필드를 사용한다.

- [ ] **Step 1: 커버 이미지 정규식 추가**

`src/Game/GameUI/communityHub.jsx`에서 기존 `BUNDLE_LINK_PATTERN` 바로 아래에 새 정규식을 추가한다:

```js
// First image in the issue body — markdown ![alt](url) or GitHub's own
// <img src="..."> attachment markup (issue bodies mix both depending on how
// the image was pasted). Used as the card/detail-view cover; posts with no
// image simply get coverImageUrl: null (existing text-only card, no error).
const COVER_IMAGE_PATTERN =
  /!\[[^\]]*\]\((https:\/\/[^\s)]+)\)|<img[^>]+src=["']([^"']+)["']/i;
```

- [ ] **Step 2: `parsePost`에서 커버 이미지 추출**

`parsePost` 함수 안, `return { ... }` 직전에 추가:

```js
  const coverImageMatch = body.match(COVER_IMAGE_PATTERN);
  const coverImageUrl = coverImageMatch ? (coverImageMatch[1] ?? coverImageMatch[2] ?? null) : null;
```

`return` 객체에 필드 추가 (`installs` 필드 다음 줄):
```js
    installs: bundleUrl && installsByFile ? installsByFile.get(bundleUrl.split("/").pop()) ?? null : null,
    coverImageUrl,
```

- [ ] **Step 3: `ScenarioCard`에 썸네일 추가**

`ScenarioCard`의 최상위 반환 `<div style={cardSurface}>` 바로 안, 아바타+제목 줄(`<div style={{ alignItems: "center", display: "flex", gap: "0.55rem" }}>`) **이전**에 삽입:

```jsx
    {post.coverImageUrl && (
      <img
        src={post.coverImageUrl}
        alt=""
        onError={(event) => { event.currentTarget.style.display = "none"; }}
        style={{
          aspectRatio: "16 / 9",
          borderRadius: "10px",
          objectFit: "cover",
          width: "100%",
        }}
      />
    )}
```

(`onError`로 깨진 이미지를 조용히 숨긴다 — 카드 전체가 깨져 보이는 것을 방지. 이미지가 처음부터 없으면(`coverImageUrl` null) 이 블록 자체가 렌더링되지 않아 기존 텍스트 전용 카드와 동일하게 보인다.)

- [ ] **Step 4: 로컬 구동 후 확인**

커뮤니티 탭을 열고(`libraryBar.jsx`의 커뮤니티 진입점 — 실제 GitHub 저장소 `Arkniem/pax-historia-scenarios`의 이슈를 실시간으로 가져온다) 실제 게시물 중 본문에 이미지가 첨부된 것과 없는 것을 하나씩 확인:
- 이미지 있는 게시물 → 카드 상단에 16:9 썸네일이 보인다.
- 이미지 없는 게시물 → 기존과 동일하게 텍스트만 있는 카드로 보인다(레이아웃 깨짐 없음).

브라우저 개발자 도구 Network 탭에서 이미지 요청이 정상 로드되는지(또는 실패 시 카드가 깨지지 않는지) 확인.

- [ ] **Step 5: 빌드/린트 확인**

```bash
npm run build
npm run lint
```

- [ ] **Step 6: 커밋**

```bash
git add src/Game/GameUI/communityHub.jsx
git commit -m "feat(hub): 커뮤니티 게시물 본문에서 커버 이미지를 추출해 카드에 표시"
```

---

## Task 4: 카드 클릭 시 상세보기(통계 + Import & Play) 열기

**Files:**
- Modify: `src/Game/GameUI/communityHub.jsx` (`CommunityPanel` 컴포넌트에 상세보기 상태/뷰 추가)

**Interfaces:**
- Consumes: `post.coverImageUrl`(Task 3에서 추가됨), 기존 `post.{title,author,description,installs,plays,upvotes,comments,url,bundleUrl}`, 기존 `handleImport(post)` 함수, 기존 `busyId` state
- Produces: 없음 (이 패널 안에서 완결)

- [ ] **Step 1: 상세보기 컴포넌트 추가**

`communityHub.jsx`에서 `ScenarioRow` 컴포넌트 정의 바로 다음에 새 컴포넌트를 추가:

```jsx
const detailStat = { color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" };

const ScenarioDetail = ({ post, busy, onImport, onBack }) => (
  <div style={{ color: "#fff" }}>
    <button
      type="button"
      onClick={onBack}
      style={{ ...pillButton, marginBottom: "0.9rem" }}
    >
      ← Back
    </button>

    {post.coverImageUrl && (
      <img
        src={post.coverImageUrl}
        alt=""
        onError={(event) => { event.currentTarget.style.display = "none"; }}
        style={{
          aspectRatio: "16 / 9",
          borderRadius: "14px",
          marginBottom: "0.9rem",
          objectFit: "cover",
          width: "100%",
        }}
      />
    )}

    <div style={{ alignItems: "center", display: "flex", gap: "0.6rem", marginBottom: "0.3rem" }}>
      {post.avatarUrl && (
        <img src={post.avatarUrl} alt={post.author} style={{ borderRadius: "50%", height: "1.8rem", width: "1.8rem" }} />
      )}
      <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>
        {post.pinned ? "📌 " : ""}{post.title}
      </h3>
    </div>
    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", marginBottom: "0.9rem" }}>
      by {post.author} · {new Date(post.createdAt).toLocaleDateString()}
    </div>

    <div style={{ display: "flex", gap: "1.1rem", marginBottom: "1rem" }}>
      {post.installs != null && <span style={detailStat}>⬇ {post.installs} installs</span>}
      <span style={detailStat}>🚀 {post.plays} played</span>
      <span style={detailStat}>👍 {post.upvotes} liked</span>
      <span style={detailStat}>💬 {post.comments} comments</span>
    </div>

    <p style={{ color: "rgba(240,244,255,0.8)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.3rem" }}>
      {post.description || "No description."}
    </p>

    <div style={{ display: "flex", gap: "0.6rem" }}>
      <button
        type="button"
        disabled={!post.bundleUrl || busy}
        onClick={() => onImport(post)}
        style={{
          alignItems: "center",
          background: post.bundleUrl ? "rgba(124,58,237,0.85)" : "rgba(255,255,255,0.08)",
          border: "none",
          borderRadius: "10px",
          color: post.bundleUrl ? "#fff" : "rgba(255,255,255,0.35)",
          cursor: post.bundleUrl && !busy ? "pointer" : "default",
          display: "flex",
          fontSize: "1rem",
          fontWeight: 700,
          justifyContent: "center",
          padding: "0.8rem 1.6rem",
        }}
      >
        {busy ? "Importing…" : "▶ Import & Play"}
      </button>
      <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ ...pillButton, textDecoration: "none" }}>
        View on GitHub ↗
      </a>
    </div>
  </div>
);
```

- [ ] **Step 2: `CommunityPanel`에 선택 상태 추가**

`CommunityPanel` 컴포넌트 상단 state 선언부(`const [publishPickerOpen, setPublishPickerOpen] = useState(false);` 다음 줄)에 추가:

```jsx
  const [selectedPost, setSelectedPost] = useState(null);
```

- [ ] **Step 3: 카드를 클릭 가능하게 만들고 선택 상태 갱신**

`ScenarioCard` 컴포넌트 정의를 수정해 `onSelect` prop을 받고 카드 최상위 `<div style={cardSurface}>`에 클릭 핸들러를 추가한다 (Import/View 버튼 클릭은 카드 선택으로 이어지면 안 되므로 `stopPropagation` 필요):

```jsx
const ScenarioCard = ({ post, busy, onImport, onSelect }) => (
  <div
    style={{ ...cardSurface, cursor: "pointer" }}
    onClick={() => onSelect(post)}
  >
```
(기존 `<div style={cardSurface}>`를 위 코드로 교체 — 나머지 내부 내용은 그대로 둔다.)

기존 "View ↗" 링크와 "Import" 버튼에 `onClick={(event) => event.stopPropagation()}`를 추가한다(링크는 `onClick`에 이벤트 파라미터를 받는 화살표로 감싸고, 버튼은 기존 `onClick={() => onImport(post)}`를 `onClick={(event) => { event.stopPropagation(); onImport(post); }}`로 바꾼다):

```jsx
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        style={{ ...pillButton, minHeight: "1.8rem", textDecoration: "none" }}
      >
        View ↗
      </a>
      <button
        type="button"
        disabled={!post.bundleUrl || busy}
        onClick={(event) => { event.stopPropagation(); onImport(post); }}
        title={post.bundleUrl ? "Import into your Scenarios" : "This post has no scenario file attached"}
        style={{
          ...pillButton,
          minHeight: "1.8rem",
          background: post.bundleUrl ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.04)",
          borderColor: post.bundleUrl ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)",
          color: post.bundleUrl ? "#fff" : "rgba(255,255,255,0.35)",
          cursor: post.bundleUrl && !busy ? "pointer" : "default",
        }}
      >
        {busy ? "Importing…" : "Import"}
      </button>
```

- [ ] **Step 4: `ScenarioRow`가 `onSelect`를 전달하도록 수정**

`ScenarioRow` 컴포넌트 시그니처와 내부 `ScenarioCard` 호출을 수정:

```jsx
const ScenarioRow = ({ title, posts, busyId, onImport, onSelect, emptyText }) => (
  <div style={{ marginBottom: "1.15rem" }}>
    <div style={rowTitleStyle}>{title}</div>
    {posts.length === 0 ? (
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", padding: "0.3rem 0 0.6rem" }}>
        {emptyText || "Nothing here yet."}
      </div>
    ) : (
      <div style={{ display: "flex", gap: "0.8rem", overflowX: "auto", paddingBottom: "0.35rem", scrollbarWidth: "thin" }}>
        {posts.map((post) => (
          <ScenarioCard key={post.id} post={post} busy={busyId === post.id} onImport={onImport} onSelect={onSelect} />
        ))}
      </div>
    )}
  </div>
);
```

각 `<ScenarioRow ... />` 호출부(4곳: Pinned/Most Installed/Most Liked/Most Recent)에 `onSelect={setSelectedPost}`를 추가한다. 예:
```jsx
          <ScenarioRow
            title="📌 Pinned"
            posts={rows.pinned}
            busyId={busyId}
            onImport={handleImport}
            onSelect={setSelectedPost}
            emptyText="No pinned scenarios right now."
          />
          <ScenarioRow title="⬇ Most Installed" posts={rows.byInstalls} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} />
          <ScenarioRow title="👍 Most Liked" posts={rows.byLikes} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} />
          <ScenarioRow title="🕐 Most Recent" posts={rows.byRecent} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} />
```

- [ ] **Step 5: `CommunityPanel`의 렌더 분기에 상세보기 추가**

`CommunityPanel`의 `return (...)` 안, 최상위 `<div style={{ color: "#fff", ... }}>` 내부를 상세보기가 선택되었는지에 따라 분기하도록 수정한다. 현재 구조는:
```jsx
  return (
    <div style={{ color: "#fff", maxHeight: "calc(100vh - 11rem)", overflowY: "auto", paddingRight: "0.2rem" }}>
      <div style={{ ...상단 툴바... }}> ... </div>
      {publishPickerOpen && ( ... )}
      {notice && ( ... )}
      {error && ( ... )}
      {!posts && !error && ( ... )}
      {rows && ( <>...4개 ScenarioRow...</> )}
    </div>
  );
```
이를 다음과 같이 바꾼다 — `selectedPost`가 있으면 상세보기만 렌더링하고 그리드/툴바는 숨긴다:
```jsx
  return (
    <div style={{ color: "#fff", maxHeight: "calc(100vh - 11rem)", overflowY: "auto", paddingRight: "0.2rem" }}>
      {selectedPost ? (
        <ScenarioDetail
          post={selectedPost}
          busy={busyId === selectedPost.id}
          onImport={handleImport}
          onBack={() => setSelectedPost(null)}
        />
      ) : (
        <>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.9rem" }}>
            {/* ...기존 상단 툴바 내용 그대로... */}
          </div>

          {publishPickerOpen && ( /* ...기존 그대로... */ )}
          {notice && ( /* ...기존 그대로... */ )}
          {error && ( /* ...기존 그대로... */ )}
          {!posts && !error && ( /* ...기존 그대로... */ )}

          {rows && (
            <>
              <ScenarioRow title="📌 Pinned" posts={rows.pinned} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} emptyText="No pinned scenarios right now." />
              <ScenarioRow title="⬇ Most Installed" posts={rows.byInstalls} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} />
              <ScenarioRow title="👍 Most Liked" posts={rows.byLikes} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} />
              <ScenarioRow title="🕐 Most Recent" posts={rows.byRecent} busyId={busyId} onImport={handleImport} onSelect={setSelectedPost} />
            </>
          )}
        </>
      )}
    </div>
  );
```
(기존 툴바/알림/로딩 블록의 실제 JSX는 지우지 않고 그대로 `<>...</>` 안으로 옮기기만 한다 — 내용 변경 없음.)

`handleImport`가 성공적으로 임포트를 마친 뒤에도 상세보기에 머무를지, 그리드로 돌아갈지는 이번 범위에서 결정하지 않는다 — 기존 `handleImport`의 동작(성공 시 `notice` 표시)을 그대로 두고, 사용자가 "← Back"으로 직접 돌아가게 한다(임포트 성공 후 자동으로 어디론가 이동시키는 로직은 추가하지 않는다 — 명시되지 않은 동작을 임의로 만들지 않는다).

- [ ] **Step 6: 로컬 구동 후 확인**

커뮤니티 탭에서 아무 카드나 클릭(Import/View 버튼이 아닌 카드 본문) → 상세보기로 전환되는지 확인. 상세보기에서:
- 커버 이미지(있는 경우) 크게 보임
- 통계 4개(⬇🚀👍💬) 보임
- 설명 전문이 잘리지 않고 보임(카드에서는 200자 제한이지만 상세보기는 `post.description`을 그대로 씀 — 다만 `parsePost`가 이미 200자로 잘라 저장하므로 실제로는 카드와 동일하게 잘린 채 보인다는 점에 유의. 전체 설명이 필요하면 `parsePost`에서 잘리지 않은 원본을 별도 필드로 보존해야 하지만, 이는 설계 문서에 명시되지 않은 추가 범위이므로 이번 Task에서는 하지 않는다 — 다음 세션에서 필요 시 별도로 다룬다).
- "← Back" 클릭 → 그리드로 복귀
- "▶ Import & Play" 클릭 → 기존 Import와 동일하게 동작(스캐너리오가 임포트됨)하는지 확인

- [ ] **Step 7: 빌드/린트 확인**

```bash
npm run build
npm run lint
```

- [ ] **Step 8: 커밋**

```bash
git add src/Game/GameUI/communityHub.jsx
git commit -m "feat(hub): 커뮤니티 카드 클릭 시 통계+Import & Play 상세보기 열기"
```

---

## Self-Review 메모 (계획 작성자 기록)

- **Spec coverage**: 설계 문서의 Phase 1 항목 2개(아이콘/국기 위치, 커버이미지+상세보기) 모두 Task 1~4로 커버됨. Non-Goals(상단 네비게이션 바, 국가선택화면, 히어로 캐러셀, 토큰/로그인 UI, 존재하지 않는 지표 생성)는 의도적으로 태스크화하지 않음.
- **Placeholder 스캔**: "TBD" 없음. Step 6(Task 4)에서 발견한 "설명 전문이 실제로는 200자 제한"이라는 기존 코드의 한계는 임시방편이 아니라 명시적으로 범위 밖으로 선언하고 이유를 남김(설계 문서에 없던 요구사항을 임의로 확장하지 않기 위함).
- **타입/시그니처 일관성**: `post.coverImageUrl`(Task 3에서 도입) → Task 4의 `ScenarioDetail`이 동일 필드명 사용. `onSelect(post)` 콜백 시그니처가 `ScenarioCard`→`ScenarioRow`→`CommunityPanel`(`setSelectedPost`) 전체에서 일관됨. `rightShift` prop이 Task 2에서 `main.jsx`(계산부)→`other.jsx`(소비부) 양쪽에서 동일한 이름/타입(문자열 CSS 값)으로 사용됨.

## TLDR

4개 태스크로 나눔: (1) 설정 아이콘 ⚙️→⋮ 교체(1줄), (2) 국가 표시를 좌상단 텍스트에서 우하단 국기 배지로 교체(커스텀 정치체는 첫 글자 배지로 폴백), (3) 커뮤니티 허브 카드에 이슈 본문 커버 이미지 추출/표시, (4) 카드 클릭 시 통계+Import & Play 버튼이 있는 상세보기 열기. 테스트 스위트가 없어 각 태스크는 빌드/린트 통과 + 브라우저 수동 확인으로 검증하고, 태스크당 1개 커밋으로 마무리한다.
