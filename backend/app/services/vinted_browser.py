import logging
from dataclasses import dataclass
from pathlib import Path

from app.config import UPLOADS_DIR, VINTED_BASE_URL

logger = logging.getLogger(__name__)


class VintedSessionExpired(Exception):
    """Raised when Vinted session needs re-authentication."""
    pass

PLAYWRIGHT_PROFILE_DIR = str(
    Path.home() / ".vintage-searcher" / "chrome-profile-copy"
)

_CONTEXT_ARGS = dict(
    headless=True,
    channel="chrome",
    viewport={"width": 1280, "height": 900},
    locale="fr-FR",
    args=["--disable-blink-features=AutomationControlled"],
)


@dataclass
class VintedItem:
    item_id: str
    title: str
    price: float
    currency: str
    image_url: str
    item_url: str
    brand: str
    size: str


def _refresh_profile_copy():
    """Copy Chrome Profile 1 to a Playwright-safe directory (skipping lock/cache files)."""
    import shutil

    chrome_profile = Path.home() / "Library" / "Application Support" / "Google" / "Chrome" / "Profile 1"
    pw_profile = Path(PLAYWRIGHT_PROFILE_DIR)

    if pw_profile.exists():
        shutil.rmtree(pw_profile)

    skip = {
        "Cache", "Code Cache", "GPUCache", "Service Worker", "blob_storage",
        "IndexedDB", "GCM Store", "File System", "BudgetDatabase", "databases",
        "Session Storage", "SingletonLock", "SingletonSocket", "SingletonCookie",
        "RunningChromeVersion",
    }
    shutil.copytree(chrome_profile, pw_profile, ignore=lambda _d, contents: [c for c in contents if c in skip])
    logger.info("Refreshed Playwright profile copy from Chrome")


async def login_to_vinted() -> bool:
    """Refresh the profile copy from Chrome and verify the Vinted session.

    Copies Chrome's cookies to the Playwright profile. If Chrome is logged
    in to Vinted, this is all that's needed — no browser window opens.
    """
    _refresh_profile_copy()

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            PLAYWRIGHT_PROFILE_DIR, **_CONTEXT_ARGS
        )
        page = context.pages[0] if context.pages else await context.new_page()

        await page.goto(VINTED_BASE_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)

        if "session-refresh" in page.url:
            await context.clear_cookies()
            await page.goto(VINTED_BASE_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)

        await _dismiss_cookies(page)

        login_btn = page.locator("[data-testid='header--login-button']")
        logged_in = await login_btn.count() == 0
        await context.close()

        if logged_in:
            logger.info("Vinted session verified (logged in)")
        else:
            logger.warning("Not logged in to Vinted. Please log in via Chrome and retry.")

        return logged_in


async def search_vinted_by_image(
    image_path: str,
    brand: str,
    category: str | None = None,
) -> list[VintedItem]:
    """
    Exact Vinted search (headless, invisible to user):
    1. Open headless Chrome with personal profile
    2. Upload image via image search
    3. Click "Search" on crop modal
    4. Add brand filter
    5. Scroll to load images, scrape top 10
    """
    from playwright.async_api import async_playwright

    abs_image_path = str(Path(image_path).resolve())
    Path(PLAYWRIGHT_PROFILE_DIR).mkdir(parents=True, exist_ok=True)

    try:
        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                PLAYWRIGHT_PROFILE_DIR, **_CONTEXT_ARGS
            )
            page = context.pages[0] if context.pages else await context.new_page()

            logger.info("Opening Vinted (headless)...")
            await page.goto(VINTED_BASE_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)

            # Handle expired session: Vinted redirects to /session-refresh in a loop
            if "session-refresh" in page.url:
                logger.warning("Session-refresh detected, refreshing profile copy from Chrome...")
                await context.close()
                _refresh_profile_copy()
                context = await p.chromium.launch_persistent_context(
                    PLAYWRIGHT_PROFILE_DIR, **_CONTEXT_ARGS
                )
                page = context.pages[0] if context.pages else await context.new_page()
                await page.goto(VINTED_BASE_URL, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(2000)

            await _dismiss_cookies(page)

            # Check if logged in — image search requires authentication
            login_btn = page.locator("[data-testid='header--login-button']")
            if await login_btn.count() > 0:
                await context.close()
                raise VintedSessionExpired(
                    "Vinted session expired. Please log in to Vinted in Chrome and resync."
                )

            # Step 1: Click image search (retry if page was slow to render)
            img_btn = page.locator('[data-testid="search-by-image-button"]').first
            for attempt in range(3):
                if await img_btn.count() > 0:
                    break
                logger.info("Image search button not found (attempt %d/3), waiting...", attempt + 1)
                await page.wait_for_timeout(2000)
                await _dismiss_cookies(page)
            if await img_btn.count() == 0:
                logger.warning("Image search button not found after retries (url: %s)", page.url)
                await context.close()
                return []

            await img_btn.click()
            await page.wait_for_timeout(1500)

            # Step 2: Upload image (retry up to 3 times — the modal can be slow)
            file_input = None
            for attempt in range(3):
                fi = page.locator("input[type=file]").first
                if await fi.count() > 0:
                    file_input = fi
                    break
                logger.info("File input not found (attempt %d/3), retrying...", attempt + 1)
                # Re-click the image search button in case modal closed
                if attempt > 0:
                    await _dismiss_cookies(page)
                    img_btn2 = page.locator('[data-testid="search-by-image-button"]').first
                    if await img_btn2.count() > 0:
                        await img_btn2.click()
                await page.wait_for_timeout(2000)
            if file_input is None:
                logger.warning("File input not found after 3 attempts")
                await context.close()
                return []

            await file_input.set_input_files(abs_image_path)
            logger.info("Image uploaded")
            await page.wait_for_timeout(2000)

            # Step 3: Click "Search" on crop modal
            search_btn = page.locator('[data-testid="confirm-crop-button"]')
            if await search_btn.count() == 0:
                search_btn = page.locator(
                    '.ReactModal__Content button:has-text("Search"), '
                    '.ReactModal__Content button:has-text("Rechercher")'
                )

            if await search_btn.count() > 0:
                await search_btn.first.click()
                logger.info("Clicked Search on crop modal")
            else:
                logger.warning("Search button not found on crop modal")
                await context.close()
                return []

            try:
                await page.wait_for_url("**/catalog**", timeout=15000)
            except Exception:
                await page.wait_for_timeout(8000)

            await page.wait_for_timeout(3000)
            current_url = page.url
            logger.info("URL after image search: %s", current_url)

            # Step 4: Add brand filter
            if "search_text" not in current_url:
                sep = "&" if "?" in current_url else "?"
                brand_encoded = brand.replace(" ", "+")
                brand_url = f"{current_url}{sep}search_text={brand_encoded}"
                logger.info("Adding brand filter...")
                await page.goto(brand_url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(5000)

            # Scroll incrementally to trigger lazy-loaded images
            for scroll_y in [400, 800, 1200, 1600]:
                await page.evaluate(f"window.scrollTo(0, {scroll_y})")
                await page.wait_for_timeout(800)

            # Step 5: Scrape results (grab extra to account for brand filtering)
            results = await _scrape_results_from_page(page, limit=30)
            results = _filter_by_brand(results, brand)
            logger.info("Got %d results from Vinted image+brand search", len(results))

            await context.close()
            return results[:10]

    except Exception:
        logger.error("Browser-based Vinted search failed", exc_info=True)
        return []


async def _dismiss_cookies(page):
    for sel in [
        "#onetrust-accept-btn-handler",
        "button:has-text('Accepter')",
        "button:has-text('Accept')",
        "[data-testid='cookie-consent-accept']",
    ]:
        try:
            btn = page.locator(sel)
            if await btn.count() > 0:
                await btn.first.click(timeout=3000)
                await page.wait_for_timeout(500)
                return
        except Exception:
            continue


def _strip_accents(s: str) -> str:
    import unicodedata
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def _filter_by_brand(items: list[VintedItem], brand: str) -> list[VintedItem]:
    """Keep only items whose scraped brand matches the search brand (fuzzy).

    Title is only used as a fallback when the brand field is empty,
    since sellers often stuff unrelated brand names into titles for SEO.
    Handles accented characters (e.g. Chloé vs Chloe).
    """
    brand_lower = _strip_accents(brand.lower())
    brand_words = set(brand_lower.split())

    def matches(text: str) -> bool:
        t = _strip_accents(text.lower())
        if brand_lower in t or t in brand_lower:
            return True
        text_words = set(t.split())
        shared = brand_words & text_words
        return len(shared) >= min(2, len(brand_words))

    def item_matches(item: VintedItem) -> bool:
        if not item.brand.strip():
            return False
        return matches(item.brand)

    filtered = [item for item in items if item_matches(item)]
    if len(filtered) < len(items):
        logger.info(
            "Brand filter kept %d/%d items for brand '%s'",
            len(filtered), len(items), brand,
        )
    return filtered


async def _scrape_results_from_page(page, *, limit: int = 10) -> list[VintedItem]:
    """Extract item data from the page using JavaScript.

    Vinted renders item cards where the <img> is a sibling of the <a> link
    (not a child).  We find each card by locating item images whose alt text
    contains "€", walk up to the common card ancestor, then pull the item
    link from that ancestor.
    """
    raw_items = await page.evaluate(r"""(limit) => {
        const items = [];
        const seen = new Set();

        const allImgs = document.querySelectorAll("img");
        for (const img of allImgs) {
            const alt = img.alt || "";
            if (!alt.includes("€")) continue;

            const src = img.src || "";
            if (!src.includes("vinted.net")) continue;

            let card = img;
            let link = null;
            for (let i = 0; i < 10; i++) {
                card = card.parentElement;
                if (!card) break;
                link = card.querySelector("a[href*='/items/']");
                if (link) break;
            }
            if (!link) continue;

            const href = link.getAttribute("href") || "";
            const idMatch = href.match(/\/items\/(\d+)/);
            if (!idMatch) continue;
            const id = idMatch[1];
            if (seen.has(id)) continue;
            seen.add(id);

            const parts = alt.split(", ");
            let title = parts[0] || "";
            let brand = "";
            let size = "";
            let price = 0;
            for (const part of parts) {
                const trimmed = part.trim();
                if (trimmed.startsWith("Brand: ")) brand = trimmed.slice(7);
                else if (trimmed.startsWith("Marque : ") || trimmed.startsWith("Marque: ")) brand = trimmed.replace(/^Marque\s*:\s*/, "");
                else if (trimmed.startsWith("Size: ")) size = trimmed.slice(6);
                else if (trimmed.startsWith("Taille : ") || trimmed.startsWith("Taille: ")) size = trimmed.replace(/^Taille\s*:\s*/, "");
                else if (trimmed.includes("€")) {
                    const m = trimmed.match(/([\d.,]+)\s*€/);
                    if (m && !price) price = parseFloat(m[1].replace(",", "."));
                }
            }

            items.push({
                id,
                title,
                price,
                currency: "EUR",
                image_url: src,
                brand,
                size,
                item_url: href.startsWith("http") ? href : "https://www.vinted.fr" + href,
            });

            if (items.length >= limit) break;
        }
        return items;
    }""", limit)

    results = []
    for item in raw_items:
        results.append(
            VintedItem(
                item_id=item["id"],
                title=item["title"],
                price=item["price"],
                currency=item["currency"],
                image_url=item["image_url"],
                item_url=item["item_url"],
                brand=item["brand"],
                size=item["size"],
            )
        )
    logger.info("Scraped %d items from page", len(results))
    return results


async def _fallback_text_search(brand: str, category: str | None = None) -> list[VintedItem]:
    from app.services.vinted import search_vinted as text_search

    logger.info("Falling back to text-based search for '%s'", brand)
    api_items = await text_search(brand, category=category)
    return [
        VintedItem(
            item_id=item.item_id,
            title=item.title,
            price=item.price,
            currency=item.currency,
            image_url=item.image_url,
            item_url=item.item_url,
            brand=item.brand,
            size=item.size,
        )
        for item in api_items
    ]
