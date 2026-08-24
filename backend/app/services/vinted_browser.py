import logging
from dataclasses import dataclass
from pathlib import Path

from app.config import UPLOADS_DIR, VINTED_BASE_URL

logger = logging.getLogger(__name__)

CHROME_PROFILE_DIR = str(
    Path.home() / "Library" / "Application Support" / "Google" / "Chrome" / "Profile 1"
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


async def login_to_vinted() -> bool:
    """Open Chrome (personal profile, visible) so user can log in to Vinted."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            CHROME_PROFILE_DIR,
            headless=False,
            channel="chrome",
            viewport={"width": 1280, "height": 900},
            locale="fr-FR",
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else await context.new_page()

        await page.goto(VINTED_BASE_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        await _dismiss_cookies(page)

        login_btn = page.locator("[data-testid='header--login-button']")
        if await login_btn.count() == 0:
            logger.info("Already logged in via Chrome profile")
            await context.close()
            return True

        await page.goto(
            f"{VINTED_BASE_URL}/member/signup/select_type?ref_url=%2F",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        await page.wait_for_timeout(2000)
        await _dismiss_cookies(page)

        logger.info("Waiting for user to log in (up to 3 min)...")
        for _ in range(90):
            await page.wait_for_timeout(2000)
            try:
                url = page.url
                on_auth = any(
                    s in url for s in ("register", "signup", "login", "select_type")
                )
                login_btn = page.locator("[data-testid='header--login-button']")
                if not on_auth and await login_btn.count() == 0:
                    logger.info("Login successful!")
                    await context.close()
                    return True
            except Exception:
                continue

        await context.close()
        return False


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

    try:
        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                CHROME_PROFILE_DIR, **_CONTEXT_ARGS
            )
            page = context.pages[0] if context.pages else await context.new_page()

            logger.info("Opening Vinted (headless)...")
            await page.goto(VINTED_BASE_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)
            await _dismiss_cookies(page)

            login_btn = page.locator("[data-testid='header--login-button']")
            if await login_btn.count() > 0:
                logger.warning("Not logged in. Please connect your Vinted account first.")
                await context.close()
                return await _fallback_text_search(brand, category)

            # Step 1: Click image search
            img_btn = page.locator('[data-testid="search-by-image-button"]').first
            if await img_btn.count() == 0:
                logger.warning("Image search button not found")
                await context.close()
                return await _fallback_text_search(brand, category)

            await img_btn.click()
            await page.wait_for_timeout(1500)

            # Step 2: Upload image
            file_input = page.locator("input[type=file]").first
            if await file_input.count() == 0:
                logger.warning("File input not found")
                await context.close()
                return await _fallback_text_search(brand, category)

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
                return await _fallback_text_search(brand, category)

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
        return await _fallback_text_search(brand, category)


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


def _filter_by_brand(items: list[VintedItem], brand: str) -> list[VintedItem]:
    """Keep only items whose brand matches the search brand (fuzzy)."""
    brand_lower = brand.lower()
    brand_words = set(brand_lower.split())

    def matches(item_brand: str) -> bool:
        ib = item_brand.lower()
        if brand_lower in ib or ib in brand_lower:
            return True
        item_words = set(ib.split())
        shared = brand_words & item_words
        return len(shared) >= min(2, len(brand_words))

    filtered = [item for item in items if matches(item.brand)]
    if not filtered:
        logger.warning("Brand filter removed all results, returning unfiltered")
        return items
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
                if (part.startsWith("Brand: ")) brand = part.slice(7);
                else if (part.startsWith("Size: ")) size = part.slice(6);
                else if (part.includes("€")) {
                    const m = part.match(/([\d.,]+)\s*€/);
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
